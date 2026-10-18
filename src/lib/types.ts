export type DownloadStatus = 'pending' | 'running' | 'paused' | 'success' | 'failed' | 'cancelled' | 'sample';
export interface DownloadItem {
  id: string;
  url: string;
  filename: string;
  status: DownloadStatus;
  bytesDownloaded: number;
  totalBytes: number;
  reason?: string;
  sample?: boolean;
  createdAt?: number;
  favorite?: boolean;
}
export type Screen = 'explore' | 'home' | 'downloads' | 'library' | 'watchlist' | 'settings';
