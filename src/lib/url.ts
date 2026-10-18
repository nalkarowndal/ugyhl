/** Initial milestone supports *direct HTTPS file URLs*, not Pawchive post pages. */
export function validateFileUrl(value: string): { valid: true; url: string } | { valid: false; message: string } {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:') return { valid: false, message: '보안을 위해 HTTPS 주소만 지원합니다.' };
    if (!parsed.hostname || parsed.username || parsed.password || parsed.port) return { valid: false, message: '호스트 정보 또는 URL 포트를 확인해 주세요.' };
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
        /^[0-9.]+$/.test(host) || host.includes(':') || !host.includes('.')) return { valid: false, message: '로컬 주소 및 직접 IP 주소는 사용할 수 없습니다.' };
    return { valid: true, url: parsed.href };
  } catch { return { valid: false, message: '올바른 HTTPS 주소를 입력해 주세요.' }; }
}

export function safeFilenameFromUrl(input: string): string {
  try {
    const segment = decodeURIComponent(new URL(input).pathname.split('/').filter(Boolean).at(-1) || 'download.bin');
    const safe = segment.replace(/[\\/\u0000-\u001f:*?"<>|]/g, '_').replace(/^\.+/, '').slice(0, 110);
    return safe || 'download.bin';
  } catch { return 'download.bin'; }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  const power = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)) - 1);
  return `${(bytes / (1024 ** (power + 1))).toFixed(1)} ${units[power]}`;
}
