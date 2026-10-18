import { useEffect, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { ArrowDownToLine, AlertTriangle, Pause, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { runningOnAndroid, enqueueDownload } from '../../lib/native';
import { safeFilenameFromUrl, validateFileUrl, formatBytes } from '../../lib/url';
import type { PawchiveBackground, BackgroundTransfer } from './background-contract';
import './background.css';

const background = registerPlugin<PawchiveBackground>('PawchiveBackground');
const captions: Record<BackgroundTransfer['state'], string> = {
  queued: '시스템 대기', running: '전송 중', paused: '중지됨', failed: '실패', success: '완료'
};
export function BackgroundTransfers() {
  const android = runningOnAndroid();
  const [available, setAvailable] = useState(false);
  const [version, setVersion] = useState(0);
  const [url, setUrl] = useState('');
  const [sha, setSha] = useState('');
  const [wifi, setWifi] = useState(false);
  const [items, setItems] = useState<BackgroundTransfer[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    if (!android) return;
    try { setItems((await background.list()).transfers); }
    catch { setMessage('보안 전송 기록을 불러오지 못했습니다.'); }
  }
  useEffect(() => {
    if (!android) return;
    let alive = true;
    background.capabilities().then(({ uidt, platformSdk }) => {
      if (alive) { setAvailable(uidt); setVersion(platformSdk); }
    }).catch(() => { if (alive) setMessage('M7 네이티브 플러그인을 확인할 수 없습니다.'); });
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2500);
    return () => { alive = false; window.clearInterval(interval); };
  }, [android]);
  async function add() {
    const parsed = validateFileUrl(url);
    if (!parsed.valid) { setMessage(parsed.message); return; }
    if (!android) { setMessage('Android에서만 다운로드할 수 있습니다.'); return; }
    if (sha.trim() && !/^[a-fA-F0-9]{64}$/.test(sha.trim())) {
      setMessage('SHA-256은 16진수 64자리로 입력하세요.'); return;
    }
    setBusy(true);
    try {
      const filename = safeFilenameFromUrl(parsed.url);
      if (available) {
        await background.start({ url: parsed.url, filename, sha256: sha.trim(), speedKiB: 0, wifiOnly: wifi });
        setMessage('Android 사용자 시작 다운로드를 요청했습니다.');
      } else {
        await enqueueDownload(parsed.url, filename, wifi);
        setMessage('Android 13 이하에서 시스템 DownloadManager로 등록했습니다.');
      }
      setUrl(''); setSha(''); await refresh();
    } catch (error) { setMessage('전송 등록 실패: ' + String(error)); }
    finally { setBusy(false); }
  }
  async function control(id: string, resume: boolean) {
    try { if (resume) await background.resume({ id }); else await background.pause({ id }); await refresh(); }
    catch(error) { setMessage('작업 변경 실패: ' + String(error)); }
  }
  return <section className="surface-card background-transfers" aria-label="M7 Android 백그라운드 다운로드">
    <div className="advanced-head"><div><p className="eyebrow">M7 · ANDROID JOBSCHEDULER</p><h2>백그라운드 전송</h2></div>
      <span className="support-chip"><ShieldCheck size={15}/> {android ? (available ? 'Android UIDT' : `시스템 전송 · API ${version}`) : '웹 미리보기'}</span></div>
    <p className="advanced-description">Android 14 이상은 사용자 시작 전송 작업(UIDT), Android 13 이하는 기본 시스템 다운로드로 등록합니다. Android는 배터리·네트워크 상황에 따라 작업을 중단하거나 재예약할 수 있으며 강제 종료 후 자동 복구는 보장하지 않습니다.</p>
    <div className="advanced-form">
      <input aria-label="백그라운드 다운로드 파일 URL" type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com/file.zip" />
      <label>선택: 원본 SHA-256<input aria-label="원본 SHA-256" spellCheck={false} autoComplete="off" value={sha} onChange={e=>setSha(e.target.value.slice(0,64))} disabled={!available} placeholder="Android 14 이상에서 적용" /></label>
      <label className="bg-wifi"><input type="checkbox" checked={wifi} onChange={e=>setWifi(e.target.checked)} /> Wi-Fi 등 비과금 네트워크 우선</label>
      <button className="primary-button" disabled={!android || busy} onClick={()=>void add()}><ArrowDownToLine size={16}/> 백그라운드 다운로드</button>
    </div>
    {!android && <p className="advanced-warning"><AlertTriangle size={16}/> 웹에서는 작업을 실행하지 않습니다. Android APK에서 사용할 수 있습니다.</p>}
    {available && <div className="background-list">{items.length===0 && <p className="advanced-empty">백그라운드 전송 기록이 없습니다.</p>}
      {items.map(item => <article className="background-entry" key={item.id}>
        <div className="background-copy"><b>{item.filename}</b><span>{captions[item.state]} · {formatBytes(item.bytes)} / {item.total>0 ? formatBytes(item.total) : '크기 미정'}</span>
          {item.error && <small>{item.error}</small>}
          {item.total>0 && <progress max={item.total} value={Math.min(item.total,item.bytes)} />}</div>
        <div className="advanced-buttons">{['queued','running'].includes(item.state) && <button aria-label="중지" onClick={()=>void control(item.id,false)}><Pause size={16}/></button>}
          {['paused','failed'].includes(item.state) && <button aria-label="다시 시작" onClick={()=>void control(item.id,true)}><Play size={16}/></button>}</div>
      </article>)}</div>}
    <div className="advanced-foot"><span>다운로드 완료 파일은 기존 SQLite 보관함에 등록됩니다. 알림 및 작업 지속 여부는 Android 정책을 따릅니다.</span>
      <button disabled={!android} onClick={()=>void refresh()}><RefreshCw size={15}/> 새로고침</button></div>
    {message && <p role="status" className="advanced-message">{message}</p>}
  </section>;
}
