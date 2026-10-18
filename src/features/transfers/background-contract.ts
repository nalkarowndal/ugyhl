export interface BackgroundTransfer {
  id: string;
  jobId: number;
  filename: string;
  state: 'queued' | 'running' | 'paused' | 'failed' | 'success';
  bytes: number;
  total: number;
  error: string;
  wifiOnly: boolean;
  sha256: string;
  created: number;
}
export interface PawchiveBackground {
  capabilities(): Promise<{ uidt: boolean; platformSdk: number }>;
  start(options: { url: string; filename: string; sha256: string; speedKiB: number; wifiOnly: boolean }): Promise<{ id: string; jobId: number }>;
  list(): Promise<{ transfers: BackgroundTransfer[] }>;
  pause(options: { id: string }): Promise<void>;
  resume(options: { id: string }): Promise<void>;
}
