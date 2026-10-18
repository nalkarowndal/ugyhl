/** Pawchive API adapter, based on upstream Pawchive Downloader v1.2.9.
 * No credentials are stored or extracted. API requests are constrained to known hosts.
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export type Provider = 'pawchive' | 'cumst';
export type MediaKind = 'image' | 'video' | 'archive' | 'audio' | 'other';
export interface CreatorTarget {
  provider: Provider;
  host: 'pawchive.pw' | 'cum.st';
  service: string;
  creatorId: string;
  postId?: string;
  displayUrl: string;
}
export interface MediaAttachment {
  key: string;
  name: string;
  url?: string;
  kind: MediaKind;
  deferred: boolean;
}
export interface CreatorPost {
  id: string;
  title: string;
  published: string;
  attachments: MediaAttachment[];
}
const allowed = new Set(['pawchive.pw', 'cum.st', 'kemono.cr']);
const segmentRe = /^[a-zA-Z0-9_~.\-]+$/;
function segment(x: string): string {
  const value = decodeURIComponent(x);
  if (!value || value.length > 140 || value === '.' || value === '..' || !segmentRe.test(value)) {
    throw new Error('작가/게시물 식별자가 올바르지 않습니다.');
  }
  return value;
}
export function parseCreatorTarget(input: string): CreatorTarget {
  const url = new URL(input.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowed.has(url.hostname.toLowerCase())) {
    throw new Error('Pawchive 또는 Cum.st의 정상적인 HTTPS 주소만 지원합니다.');
  }
  if (url.search || url.hash) throw new Error('쿼리·인증 정보가 포함된 주소는 제거해 주세요.');
  const parts = url.pathname.split('/').filter(Boolean).map(segment);
  let service = '', creatorId = '', postId: string|undefined;
  // /patreon/user/123/post/456, /artists/patreon/123, /posts/patreon/123/456
  if (parts.length >= 3 && parts[1] === 'user') {
    [service,,creatorId] = parts;
    if (parts.length > 3) {
      if (parts.length !== 5 || !['post','dm'].includes(parts[3])) throw new Error('지원하지 않는 게시물 URL 형식입니다.');
      postId = parts[4];
    }
  } else if (parts.length === 3 && ['artists','creators'].includes(parts[0])) {
    [,service,creatorId] = parts;
  } else if (parts.length === 4 && parts[0] === 'posts') {
    [,service,creatorId,postId] = parts;
  } else throw new Error('작가 또는 게시물 URL을 입력해 주세요. 예: https://pawchive.pw/patreon/user/123');
  const provider: Provider = url.hostname === 'cum.st' ? 'cumst' : 'pawchive';
  const host = provider === 'cumst' ? 'cum.st' : 'pawchive.pw';
  return { provider, host, service, creatorId, postId, displayUrl: `https://${host}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}${postId ? '/post/'+encodeURIComponent(postId) : ''}`};
}
export function apiUrl(target: CreatorTarget, page = 0): string {
  const root = `https://${target.host}/api/v1/${encodeURIComponent(target.service)}/user/${encodeURIComponent(target.creatorId)}`;
  if (target.postId) return `${root}/post/${encodeURIComponent(target.postId)}`;
  const offset = Math.min(100000, Math.max(0, Math.floor(page))) * 50;
  return target.provider === 'cumst' ? `${root}/posts?o=${offset}&n=50` : `${root}?o=${offset}`;
}
export function getMediaKind(filename: string): MediaKind {
  const ext = (filename.split('?')[0].split('.').pop() || '').toLowerCase();
  if (['jpg','jpeg','png','gif','webp','bmp','avif','heic'].includes(ext)) return 'image';
  if (['mp4','webm','mkv','mov','m4v','avi'].includes(ext)) return 'video';
  if (['zip','7z','rar','tar','gz','bz2'].includes(ext)) return 'archive';
  if (['mp3','ogg','flac','wav','m4a','aac','opus'].includes(ext)) return 'audio';
  return 'other';
}
/** Only HTTPS links; rejects local addresses. Signed download URLs stay in memory. */
export function downloadUrl(path: unknown, target: CreatorTarget): string | undefined {
  if (typeof path !== 'string' || !path.trim() || path.length > 8192) return;
  try {
    const candidate = new URL(path, `https://${target.host}`);
    if (candidate.protocol !== 'https:' || candidate.username || candidate.password || candidate.port) return;
    const hostname = candidate.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
        /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.startsWith('[') || hostname === '0.0.0.0' || hostname === '255.255.255.255' ||
        !hostname.includes('.') || candidate.hash) return;
    return candidate.href;
  } catch { return; }
}
function object(value: unknown): Record<string,unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : null;
}
function str(value: unknown, fallback = ''): string { return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback; }
function attachment(value: unknown, target: CreatorTarget, key: string): MediaAttachment | null {
  const item = object(value);
  if (!item) return null;
  const name = str(item.name || item.filename, 'file').slice(0,200);
  const url = downloadUrl(item.path || item.url, target);
  const deferred = item.deferred === true && !url;
  return {key,name,url,kind:getMediaKind(name),deferred};
}
export function normalizePosts(response: unknown, target: CreatorTarget): CreatorPost[] {
  const data = object(response);
  const raw: unknown = Array.isArray(response) ? response : Array.isArray(data?.posts) ? data.posts : Array.isArray(data?.results) ? data.results : data?.post ? [data.post] : data ? [data] : [];
  if (!Array.isArray(raw)) throw new Error('서버의 게시물 데이터 형식이 다릅니다.');
  return raw.slice(0,100).flatMap((input, index): CreatorPost[] => {
    const post = object(input); if (!post) return [];
    const id = str(post.id, String(index));
    const result: MediaAttachment[] = [];
    const first = attachment(post.file,target,`${id}:main`);
    if (first && (first.url || first.deferred)) result.push(first);
    const arr = Array.isArray(post.attachments) ? post.attachments : [];
    arr.slice(0,300).forEach((item,i)=>{
      const itemResult = attachment(item,target,`${id}:${i}`);
      if (itemResult && (itemResult.url || itemResult.deferred)) result.push(itemResult);
    });
    const unique = new Map<string,MediaAttachment>();
    for (const file of result) unique.set((file.url || file.key),file);
    return [{id,title:str(post.title,'제목 없는 게시물').slice(0,250),published:str(post.published || post.added || post.edited),attachments:[...unique.values()]}];
  });
}
export async function fetchCreatorPage(target: CreatorTarget, page: number): Promise<CreatorPost[]> {
  const url = apiUrl(target,page);
  let payload:unknown;
  if (Capacitor.getPlatform() === 'android') {
    const result = await CapacitorHttp.get({url,connectTimeout:12000,readTimeout:20000,headers:{Accept:'application/json'}});
    if (result.status < 200 || result.status >= 300) throw new Error(`서버 응답: HTTP ${result.status}`);
    payload = result.data;
  } else {
    let response: Response;
    try { response = await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000),credentials:'omit'}); }
    catch { throw new Error('웹에서 API 접속이 차단되었거나 네트워크 연결에 실패했습니다. Android 앱에서 다시 시도해 주세요.'); }
    if (!response.ok) throw new Error(`서버 응답: HTTP ${response.status}`);
    const size = Number(response.headers.get('content-length') || '0');
    if (size > 5_000_000) throw new Error('서버 응답이 너무 큽니다.');
    payload = await response.json();
  }
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { throw new Error('서버가 JSON이 아닌 데이터를 반환했습니다.'); }
  }
  return normalizePosts(payload,target);
}
