import type { BackgroundTransfer } from './background-contract';
type State = BackgroundTransfer['schedulerState'];
/** OS scheduling diagnostics: never treat queued as a transfer failure. */
export function schedulerCaption(state: State): string {
  switch (state) {
    case 'EXECUTING': return 'Android에서 실행 중';
    case 'WAIT_NETWORK': return '네트워크 연결을 기다리는 중';
    case 'WAIT_DEVICE': return '기기 상태 또는 배터리 제한으로 대기 중';
    case 'WAIT_QUOTA': return '시스템 작업 제한으로 대기 중';
    case 'WAIT_SYSTEM': return '시스템이 실행 순서를 조정 중';
    case 'MISSING_JOB': return '시스템에서 작업을 찾지 못함';
    case 'UNKNOWN': return '현재 시스템 상태를 확인할 수 없음';
    default: return '';
  }
}
