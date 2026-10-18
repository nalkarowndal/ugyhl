import type { DownloadItem } from '../../lib/types';
export type LibraryKind = 'all' | 'image' | 'video' | 'archive' | 'audio' | 'other';
export type LibrarySort = 'newest' | 'oldest' | 'name' | 'size';

export function fileKind(filename: string): Exclude<LibraryKind,'all'> {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (['jpg','jpeg','png','webp','gif','avif','heic','bmp','tif','tiff'].includes(ext)) return 'image';
  if (['mp4','m4v','mkv','webm','mov','avi','wmv'].includes(ext)) return 'video';
  if (['zip','rar','7z','tar','gz','bz2','xz'].includes(ext)) return 'archive';
  if (['mp3','m4a','aac','ogg','opus','wav','flac'].includes(ext)) return 'audio';
  return 'other';
}
export function libraryItems(
  tasks: DownloadItem[],
  opts: { query?: string; kind?: LibraryKind; favoriteOnly?: boolean; sort?: LibrarySort }
): DownloadItem[] {
  const q = (opts.query ?? '').trim().toLocaleLowerCase();
  const kind = opts.kind ?? 'all';
  const sort = opts.sort ?? 'newest';
  return tasks.filter(task => task.status === 'success' && !task.sample &&
    (!q || task.filename.toLocaleLowerCase().includes(q)) &&
    (kind === 'all' || fileKind(task.filename) === kind) &&
    (!opts.favoriteOnly || task.favorite === true)
  ).sort((a,b)=> {
    if (sort === 'name') return a.filename.localeCompare(b.filename);
    if (sort === 'size') return b.totalBytes - a.totalBytes;
    return (sort === 'oldest' ? 1 : -1) * ((a.createdAt ?? 0) - (b.createdAt ?? 0));
  });
}
