export interface TableStats {
  pendingRecords: number;
  pendingDays: number;
  oldestDate: string | null;
}

export interface ArchiveStats {
  zendeskWebhook: TableStats;
  openaiLogs: TableStats;
  responsesSuggested: TableStats;
  runningJobs: number;
  completedJobs: number;
  totalArchivedRecords: number;
  inconsistentJobs: number;
}

export interface ArchiveProgress {
  tableName: string;
  status: string;
  currentDate: string | null;
  currentHour: number | null;
  recordsArchived: number;
  recordsDeleted: number;
}

export interface ArchiveJob {
  id: number;
  tableName: string;
  archiveDate: string;
  status: string;
  recordsArchived: number;
  recordsDeleted: number;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
  filePath?: string | null;
  fileSize?: number | null;
}

export interface ActiveJob {
  id: number;
  tableName: string;
  archiveDate: string;
  status: string;
  progress: ArchiveProgress | null;
  errorMessage: string | null;
  recordsArchived: number;
  recordsDeleted: number;
}

export interface ArchiveTableConfig {
  name: string;
  dateColumn: string;
}

export interface HourlyArchiveResult {
  archived: number;
  deleted: number;
  filePath: string | null;
  fileSize: number | null;
  minId?: number;
  maxId?: number;
}
