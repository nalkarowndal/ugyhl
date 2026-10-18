import { expect, test } from 'vitest';
import { validateFileUrl, safeFilenameFromUrl, formatBytes } from './url';
test('only direct HTTPS is accepted', () => {
  expect(validateFileUrl('https://example.com/video.mp4').valid).toBe(true);
  expect(validateFileUrl('javascript:alert(1)').valid).toBe(false);
  expect(validateFileUrl('http://example.com/a.zip').valid).toBe(false);
  expect(validateFileUrl('https://user:pass@example.com/a').valid).toBe(false);
  expect(validateFileUrl('file:///etc/passwd').valid).toBe(false);
});
test('untrusted name is sanitized', () => {
  expect(safeFilenameFromUrl('https://example.com/a%3Ab.mp4')).toBe('a_b.mp4');
  expect(safeFilenameFromUrl('https://example.com/%2E%2E%2Fsecret.txt')).toBe('.._secret.txt'.replace(/^\.+/, ''));
});
test('formats sizes', () => {
  expect(formatBytes(0)).toBe('0 B');
  expect(formatBytes(1048576)).toBe('1.0 MB');
});
