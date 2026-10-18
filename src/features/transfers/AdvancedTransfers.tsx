import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowDownToLine, Gauge, Pause, Play, RefreshCw } from 'lucide-react';
import { registerPlugin } from '@capacitor/core';
import { runningOnAndroid } from '../../lib/native';
import { formatBytes, safeFilenameFromUrl, validateFileUrl } from '../../lib/url';
import type { PawchiveTransfers, TransferRecord } from './transfer-contract';
import './transfers.css';

const plugin = registerPlugin<PawchiveTransfers>('PawchiveTransfers');
const label: Record<TransferRecord['state'],string> = {
  queued:'대기 중',running:'다운로드 중',pausing:'일시정지 처리 중',paused:'일시정지됨',
  failed:'실패',success:'완료'
};
export function AdvancedTransfers() {
  const android=runningOnAndroid();
  const [url,setUrl]=useState('');
  const [limit,setLimit]=useState(0);
  const [items,setItems]=useState<TransferRecord[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const refresh=useCallback(async()=>{
    if(!android)return;
    try{setItems((await plugin.list()).transfers)}catch(error){setMessage('전송 기록 조회 실패: '+String(error))}
  },[android]);
  useEffect(()=>{
    if(!android)return;
    void refresh();const timer=window.setInterval(()=>void refresh(),1500);
    return()=>window.clearInterval(timer);
  },[android,refresh]);
  async function start(){
    const safe=validateFileUrl(url);
    if(!safe.valid){setMessage(safe.message);return;}
    if(!android){setMessage('실제 전송 기능은 Android APK에서만 사용할 수 있습니다.');return;}
    setBusy(true);
    try{
      await plugin.start({url:safe.url,filename:safeFilenameFromUrl(safe.url),speedKiB:limit});
      setUrl('');setMessage('고급 다운로드를 등록했습니다.');await refresh();
    }catch(error){setMessage('전송 등록 실패: '+String(error))}
    finally{setBusy(false)}
  }
  async function action(id:string,method:'pause'|'resume'){
    try{if(method==='pause')await plugin.pause({id});else await plugin.resume({id});await refresh();}
    catch(error){setMessage('전송 제어 실패: '+String(error))}
  }
  return <section className="surface-card advanced-transfers" aria-label="M4 이어받기 엔진">
    <div className="advanced-head"><div><p className="eyebrow">M5 · SECURE EXPERIMENTAL</p><h2>고급 다운로드 엔진</h2></div><span className="support-chip"><Gauge size={15}/> Range 이어받기</span></div>
    <p className="advanced-description">일시정지·재개와 작업별 속도 제한을 지원합니다. 완료 파일은 보관함에 등록됩니다. URL 기록은 Android Keystore로 암호화하지만 앱 종료 후 지속 실행은 보장하지 않습니다. 백그라운드 장시간 다운로드는 위의 Android 기본 다운로드를 사용하세요.</p>
    <div className="advanced-form"><input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://.../file.zip" aria-label="고급 다운로드 HTTPS URL"/>
      <label>속도 제한(KiB/s, 0=무제한)<input type="number" min="0" max="102400" step="128" value={limit} onChange={e=>setLimit(Math.min(102400,Math.max(0,Number(e.target.value)||0)))}/></label>
      <button className="primary-button" disabled={busy || !android} onClick={()=>void start()}><ArrowDownToLine size={16}/> 전송 시작</button></div>
    {!android&&<p className="advanced-warning"><AlertTriangle size={16}/> 브라우저에서는 작업이 실행되지 않습니다. 실제 전송·이어받기는 Android 앱에서만 가능합니다.</p>}
    <div className="advanced-list" aria-live="polite">{items.length===0&&<p className="advanced-empty">고급 전송 기록이 없습니다.</p>}
      {items.map(item=><article className="advanced-entry" key={item.id}>
        <div><b title={item.name}>{item.name}</b><span>{label[item.state]} · {formatBytes(item.bytes)} / {item.total>0?formatBytes(item.total):'크기 알 수 없음'} · {item.speedKiB?`${item.speedKiB} KiB/s`:'제한 없음'}</span>
          {item.error&&<small>{item.error}</small>}
          {item.total>0&&<progress max={item.total} value={Math.min(item.total,item.bytes)}/>}</div>
        <div className="advanced-buttons">{['running','queued'].includes(item.state)&&<button onClick={()=>void action(item.id,'pause')} title="일시정지"><Pause size={17}/></button>}
          {['paused','failed'].includes(item.state)&&<button onClick={()=>void action(item.id,'resume')} title="이어받기"><Play size={17}/></button>}</div>
      </article>)}
    </div>
    <div className="advanced-foot"><span><Activity size={14}/> 원본 DownloadManager 다운로드와 별개인 실험적 전송 목록입니다. 완료한 파일은 SQLite 보관함에 등록됩니다. 재실행 후 미완료 작업은 수동 재개하세요.</span><button onClick={()=>void refresh()} disabled={!android}><RefreshCw size={15}/> 새로고침</button></div>
    {message&&<p role="status" className="advanced-message">{message}</p>}
  </section>;
}
