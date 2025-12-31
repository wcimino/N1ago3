import { objectStorageClient } from "../../../../replit_integrations/object_storage/objectStorage.js";
import { withRetry } from "../../../../../shared/utils/retry.js";

const MAX_UPLOAD_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

export interface UploadMetadata {
  tableName: string;
  archiveDate: string;
  hour?: string;
  recordCount: number;
  minId: number;
  maxId: number;
}

export interface ExistingFileInfo {
  recordCount: number;
  minId: number;
  maxId: number;
  fileSize: number;
}

export function getEnvironmentPrefix(): string {
  return process.env.REPLIT_DEPLOYMENT ? "prod" : "dev";
}

export function buildStoragePath(
  tableName: string,
  dateStr: string,
  hourStr?: string
): string {
  const envPrefix = getEnvironmentPrefix();
  const suffix = hourStr ? `${hourStr}.parquet` : "day.parquet";
  return `archives/${envPrefix}/${tableName}/${dateStr}/${suffix}`;
}

function parseStoragePath(storageFileName: string): { bucket: any; objectName: string; file: any } {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) {
    throw new Error("PRIVATE_OBJECT_DIR not configured");
  }

  const fullPath = `${privateDir}/${storageFileName}`;
  const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
  const bucketName = pathParts[0];
  const objectName = pathParts.slice(1).join("/");
  const bucket = objectStorageClient.bucket(bucketName);

  return { bucket, objectName, file: bucket.file(objectName) };
}

export async function checkExistingFile(
  storageFileName: string
): Promise<ExistingFileInfo | null> {
  const { file } = parseStoragePath(storageFileName);

  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }

  const [metadata] = await file.getMetadata();
  const recordCount = Number(metadata.metadata?.recordCount || 0);
  const minId = Number(metadata.metadata?.minId || 0);
  const maxId = Number(metadata.metadata?.maxId || 0);

  if (recordCount > 0 && minId > 0 && maxId > 0) {
    return {
      recordCount,
      minId,
      maxId,
      fileSize: Number(metadata.size || 0),
    };
  }

  return null;
}

export async function deleteFileIfInvalid(storageFileName: string): Promise<void> {
  const { file } = parseStoragePath(storageFileName);
  const [exists] = await file.exists();
  if (exists) {
    console.log(`[StorageUploader] Deleting file with invalid metadata: ${storageFileName}`);
    await file.delete().catch(() => {});
  }
}

export async function uploadWithVerification(
  tempFilePath: string,
  storageFileName: string,
  metadata: UploadMetadata
): Promise<number> {
  const { bucket, objectName, file } = parseStoragePath(storageFileName);

  const tmpObjectName = `${objectName}.tmp`;
  const tmpFile = bucket.file(tmpObjectName);

  await withRetry(
    async () => {
      await bucket.upload(tempFilePath, {
        destination: tmpObjectName,
        contentType: "application/octet-stream",
        metadata: {
          metadata: {
            tableName: metadata.tableName,
            archiveDate: metadata.archiveDate,
            ...(metadata.hour && { hour: metadata.hour }),
            recordCount: metadata.recordCount.toString(),
            minId: metadata.minId.toString(),
            maxId: metadata.maxId.toString(),
          },
        },
      });
    },
    {
      maxRetries: MAX_UPLOAD_RETRIES,
      initialBackoffMs: INITIAL_RETRY_DELAY_MS,
      operationName: `Upload ${storageFileName}.tmp`,
    }
  );

  const [tmpExists] = await tmpFile.exists();
  if (!tmpExists) {
    throw new Error("Upload verification failed - temp file not found in storage");
  }

  const [tmpMetadata] = await tmpFile.getMetadata();
  const uploadedRecordCount = Number(tmpMetadata.metadata?.recordCount || 0);

  if (uploadedRecordCount !== metadata.recordCount) {
    await tmpFile.delete().catch(() => {});
    throw new Error(
      `Record count mismatch: wrote ${metadata.recordCount} but metadata shows ${uploadedRecordCount}`
    );
  }

  await withRetry(
    async () => {
      await tmpFile.copy(file);
      await tmpFile.delete();
    },
    {
      maxRetries: MAX_UPLOAD_RETRIES,
      initialBackoffMs: INITIAL_RETRY_DELAY_MS,
      operationName: `Rename ${storageFileName}.tmp to final`,
    }
  );

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error("Rename verification failed - final file not found in storage");
  }

  const [finalMetadata] = await file.getMetadata();
  return Number(finalMetadata.size || 0);
}
