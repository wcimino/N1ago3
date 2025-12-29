import { objectStorageClient } from "../../../../replit_integrations/object_storage/objectStorage.js";
import { getEnvironmentPrefix } from "./parquetExporter.js";

export interface HourRange {
  startOfHour: Date;
  endOfHour: Date;
}

export interface StorageFileInfo {
  storageFileName: string;
  fullPath: string;
  bucketName: string;
  objectName: string;
}

export function getHourRange(archiveDate: Date, hour: number): HourRange {
  const startOfHour = new Date(archiveDate);
  startOfHour.setHours(hour, 0, 0, 0);
  const endOfHour = new Date(archiveDate);
  endOfHour.setHours(hour, 59, 59, 999);
  return { startOfHour, endOfHour };
}

export function getStorageFileInfo(tableName: string, archiveDate: Date, hour: number): StorageFileInfo {
  const dateStr = archiveDate.toISOString().split("T")[0];
  const hourStr = hour.toString().padStart(2, "0");
  const envPrefix = getEnvironmentPrefix();
  const storageFileName = `archives/${envPrefix}/${tableName}/${dateStr}/${hourStr}.parquet`;

  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) {
    throw new Error("PRIVATE_OBJECT_DIR not configured");
  }

  const fullPath = `${privateDir}/${storageFileName}`;
  const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
  const bucketName = pathParts[0];
  const objectName = pathParts.slice(1).join("/");

  return { storageFileName, fullPath, bucketName, objectName };
}

export async function getExistingFileMetadata(bucketName: string, objectName: string): Promise<{
  exists: boolean;
  recordCount: number;
  minId: number;
  maxId: number;
  fileSize: number;
} | null> {
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  
  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }

  const [metadata] = await file.getMetadata();
  return {
    exists: true,
    recordCount: Number(metadata.metadata?.recordCount || 0),
    minId: Number(metadata.metadata?.minId || 0),
    maxId: Number(metadata.metadata?.maxId || 0),
    fileSize: Number(metadata.size || 0),
  };
}

export async function deleteExistingFile(bucketName: string, objectName: string): Promise<boolean> {
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  
  const [exists] = await file.exists();
  if (exists) {
    try {
      await file.delete();
      return true;
    } catch (err: any) {
      console.warn(`[ArchiveHelpers] Could not delete existing file: ${err.message}`);
      return false;
    }
  }
  return false;
}

export type ProgressCallback = (count: number) => void;

export interface ArchiveHourResult {
  archived: number;
  deleted: number;
  filePath: string | null;
  fileSize: number | null;
  minId?: number;
  maxId?: number;
}
