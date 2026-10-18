import { Capacitor, registerPlugin } from '@capacitor/core';
import type { DownloadItem } from './types';

export interface NativeDownloadRecord {
  id: string;
  url: string;
  filename: string;
  status: string;
  bytesDownloaded: number;
  totalBytes: number;
  reason?: string;
  createdAt?: number;
  favorite?: boolean;
}
interface PawchiveDownloadsPlugin {
  enqueue(options: { url: string; filename: string; wifiOnly: boolean }): Promise<{ id: string }>;
  list(): Promise<{ downloads: NativeDownloadRecord[] }>;
  retry(options: { id: string; wifiOnly: boolean }): Promise<{ id: string; reused?: boolean }>;
  cancel(options: { id: string }): Promise<{ success: boolean }>;
  favorite(options: { id: string; favorite: boolean }): Promise<{ success: boolean }>;
  open(options: { id: string }): Promise<{ success: boolean }>;
  thumbnail(options: { id: string }): Promise<{ dataUrl: string }>;
  delete(options: { id: string }): Promise<{ success: boolean }>;
}

const native = registerPlugin<PawchiveDownloadsPlugin>('PawchiveDownloads');

export const runningOnAndroid = () => Capacitor.getPlatform() === 'android';
export async function getDownloads(): Promise<DownloadItem[]> {
  if (!runningOnAndroid()) return [];
  const response = await native.list();
  return response.downloads.map((task): DownloadItem => ({
    ...task,
    url: '', // The bridge never exposes persisted signed URLs to UI state.
    status: ['pending','running','paused','success','failed','cancelled'].includes(task.status)
      ? task.status as DownloadItem['status'] : 'failed',
  }));
}
export async function enqueueDownload(url: string, filename: string, wifiOnly: boolean): Promise<string> {
  if (!runningOnAndroid()) throw new Error('실제 다운로드는 Android APK에서만 지원합니다. 브라우저는 UI 검수용입니다.');
  const result = await native.enqueue({ url, filename, wifiOnly });
  return result.id;
}
export async function retryDownload(id: string, wifiOnly: boolean): Promise<{id:string; reused:boolean}> {
  if (!runningOnAndroid()) throw new Error('Android 앱에서만 다운로드 재시도가 가능합니다.');
  const result = await native.retry({ id, wifiOnly });
  return {id: result.id, reused: result.reused === true};
}
export async function cancelDownload(id: string): Promise<boolean> {
  if (!runningOnAndroid()) return false;
  const result = await native.cancel({ id });
  return result.success;
}

export async function setDownloadFavorite(id: string, favorite: boolean): Promise<boolean> {
  if (!runningOnAndroid()) throw new Error('Android 앱에서만 즐겨찾기를 변경할 수 있습니다.');
  return (await native.favorite({ id, favorite })).success;
}
export async function openDownloadedFile(id: string): Promise<boolean> {
  if (!runningOnAndroid()) throw new Error('Android 앱에서만 파일을 열 수 있습니다.');
  return (await native.open({ id })).success;
}
export async function requestThumbnail(id: string): Promise<string> {
  if (!runningOnAndroid()) throw new Error('Android 앱에서만 실제 미리보기를 제공합니다.');
  return (await native.thumbnail({ id })).dataUrl;
}
export async function deleteDownloadFile(id: string): Promise<boolean> {
  if (!runningOnAndroid()) throw new Error('Android 앱에서만 실제 파일을 삭제할 수 있습니다.');
  return (await native.delete({ id })).success;
}
