export interface BackgroundTransfer {
  id: string;
  jobId: number;
  filename: string;
  state: 'queued' | 'running' | 'paused' | 'failed' | 'success';
  bytes: number;
  total: number;
  error: string;
  schedulerState?: 'EXECUTING' | 'WAIT_NETWORK' | 'WAIT_DEVICE' | 'WAIT_QUOTA' | 'WAIT_SYSTEM' | 'MISSING_JOB' | 'UNKNOWN';
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
