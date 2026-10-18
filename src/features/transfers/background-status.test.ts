import { describe, expect, it } from 'vitest';
import { schedulerCaption } from './background-status';
describe('Android JobScheduler diagnostic captions', () => {
  it('reports network and device waits without claiming failure', () => {
    expect(schedulerCaption('WAIT_NETWORK')).toContain('네트워크');
    expect(schedulerCaption('WAIT_DEVICE')).toContain('배터리');
    expect(schedulerCaption('WAIT_SYSTEM')).toContain('시스템');
  });
  it('handles running, missing and unknown states', () => {
    expect(schedulerCaption('EXECUTING')).toContain('실행');
    expect(schedulerCaption('MISSING_JOB')).toContain('찾지 못함');
    expect(schedulerCaption(undefined)).toBe('');
  });
});
