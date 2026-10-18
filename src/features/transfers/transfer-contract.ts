/**
 * M4 experimental Android native transfer bridge contract.
 * Unlike M3 DownloadManager files, these tasks are app-session transfers and
 * completed files are indexed into the SQLite gallery in M5.
 */
export interface TransferRecord {
  id: string;
  name: string;
  state: 'queued' | 'running' | 'pausing' | 'paused' | 'failed' | 'success';
  bytes: number;
  total: number;
  speedKiB: number;
  error?: string;
}
export interface PawchiveTransfers {
  start(options: { url: string; filename: string; speedKiB: number }): Promise<{ id: string }>;
  list(): Promise<{ transfers: TransferRecord[] }>;
  pause(options: { id: string }): Promise<void>;
  resume(options: { id: string }): Promise<void>;
  setSpeed(options: { id: string; speedKiB: number }): Promise<void>;
}
