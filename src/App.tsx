import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, Bell, Check, CheckCircle2, ChevronRight, CircleAlert, CloudDownload, Download, ExternalLink, FileArchive, FolderOpen, HardDriveDownload, Heart, Home, Images, Info, Link2, ListFilter, PauseCircle, Play, Plus, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Trash2, Wifi, X } from 'lucide-react';
import type { DownloadItem, Screen } from './lib/types';
import { cancelDownload, enqueueDownload, getDownloads, retryDownload, runningOnAndroid } from './lib/native';
import { formatBytes, safeFilenameFromUrl, validateFileUrl } from './lib/url';
import { readSettings, readWatchlist, saveSettings, saveWatchlist } from './lib/storage';
import { CreatorExplorer } from './features/explorer/CreatorExplorer';
import { LibraryView } from './features/library/LibraryView';
import { AdvancedTransfers } from './features/transfers/AdvancedTransfers';
import { BackgroundTransfers } from './features/transfers/BackgroundTransfers';

const samples: DownloadItem[] = [
  { id:'example-1', filename:'Illustration_collection.zip', url:'https://example.com/collection.zip',status:'success',bytesDownloaded:209715200,totalBytes:209715200,sample:true },
  { id:'example-2', filename:'Artwork_001.png',url:'https://example.com/artwork.png',status:'running',bytesDownloaded:28311552,totalBytes:47185920,sample:true },
  { id:'example-3', filename:'Sample_video.mp4',url:'https://example.com/video.mp4',status:'paused',bytesDownloaded:52428800,totalBytes:209715200,sample:true },
];
const statusCopy: Record<DownloadItem['status'],string> = {
  pending:'대기 중', running:'다운로드 중', paused:'일시 중지 / 재시도 대기', success:'완료', failed:'실패', cancelled:'취소됨', sample:'미리보기'
};
const navigation: { key: Screen; name: string; icon: typeof Home }[] = [
  {key:'home',name:'홈',icon:Home}, {key:'explore',name:'작가 탐색',icon:Search}, {key:'downloads',name:'다운로드',icon:Download}, {key:'library',name:'보관함',icon:Images}, {key:'watchlist',name:'관심 작가',icon:Heart}, {key:'settings',name:'설정',icon:Settings2}
];
function FileIcon({file}:{file:string}) {
  const lower=file.toLowerCase();
  return lower.match(/\.(zip|rar|7z|gz)$/)? <FileArchive size={22}/> :lower.match(/\.(png|jpe?g|webp|gif)$/)?<Images size={22}/>:<CloudDownload size={22}/>;
}
function Logo(){ return <span className="logo-symbol" aria-hidden="true"><span className="paw">✦</span></span> }
function SectionHeading({eyebrow,title,children}:{eyebrow?:string,title:string,children?:React.ReactNode}){
  return <div className="section-heading"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{children}</div>
}
function DownloadCard({task,onCancel,onRetry,retrying}:{task:DownloadItem;onCancel:(id:string)=>void;onRetry:(task:DownloadItem)=>void;retrying?:boolean}) {
  const pct=task.totalBytes>0 ? Math.min(100,Math.round(task.bytesDownloaded/task.totalBytes*100)):0;
  return <article className="download-card">
    <div className="item-icon"><FileIcon file={task.filename}/></div>
    <div className="download-copy"><div className="download-name-row"><h3 title={task.filename}>{task.filename}</h3>{task.sample&&<span className="sample-chip">샘플</span>}</div>
      <div className="item-meta"><span className={'status-text status-'+task.status}>{statusCopy[task.status]}</span><span className="dot-sep">·</span><span>{formatBytes(task.bytesDownloaded)} / {task.totalBytes > 0 ? formatBytes(task.totalBytes):'알 수 없음'}</span></div>
      {task.status==='running'&&<div className="progress-line"><div style={{width:`${pct}%`}}/></div>}
      {task.reason&&task.status==='failed'&&<p className="failure-reason" title={task.reason}>상세 코드: {task.reason}</p>}
    </div>
    <div className="download-actions">{task.status==='running'&&<span className="percent">{task.totalBytes>0?`${pct}%`:'진행 중'}</span>}
    {!task.sample && ['pending','running','paused'].includes(task.status)&&<button className="round-button" title="취소" aria-label={task.filename+' 취소'} onClick={()=>onCancel(task.id)}><X size={17}/></button>}
    {!task.sample && ['failed','cancelled'].includes(task.status)&&<button className="round-button" title="다시 다운로드" aria-label={task.filename+' 다시 다운로드'} disabled={retrying} onClick={()=>onRetry(task)}><RefreshCw size={17}/></button>}
    {task.status==='success'&&<CheckCircle2 size={21} className="green-icon"/>}</div>
  </article>
}
function Empty({icon:Icon,title,description,action}:{icon:typeof Home;title:string;description:string;action?:React.ReactNode}) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={25}/></div><h3>{title}</h3><p>{description}</p>{action}</div>
}
export default function App(){
  const [screen,setScreen]=useState<Screen>('home');
  const [url,setUrl]=useState('');
  const [watchInput,setWatchInput]=useState('');
  const [watchlist,setWatchlist]=useState<string[]>(readWatchlist);
  const [settings,setSettings]=useState(readSettings);
  const [downloads,setDownloads]=useState<DownloadItem[]>([]);
  const [showExamples,setShowExamples]=useState(false);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [retryingId,setRetryingId]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [queueFilter,setQueueFilter]=useState('all');
  const native=runningOnAndroid();
  const tasks=showExamples ? [...downloads,...samples] : downloads;
  const completed=downloads.filter(t=>t.status==='success').length;
  const active=downloads.filter(t=>t.status==='running'||t.status==='pending').length;
  const refresh=useCallback(async()=>{if(!native)return;try{setDownloads(await getDownloads());}catch(e){setNotice(`다운로드 상태를 가져오지 못했습니다: ${String(e)}`)}},[native]);
  useEffect(()=>{if(!native)return;void refresh();const interval=setInterval(()=>{void refresh()},2500);return()=>clearInterval(interval)},[native,refresh]);
  useEffect(()=>{saveWatchlist(watchlist)},[watchlist]);
  useEffect(()=>{saveSettings(settings)},[settings]);
  useEffect(()=>{if(!notice)return;const tid=setTimeout(()=>setNotice(''),5500);return()=>clearTimeout(tid)},[notice]);

  const addDownload=async()=>{
    const result=validateFileUrl(url);
    if(!result.valid){setNotice(result.message);return}
    if(!native){setNotice('브라우저는 UI 검수용입니다. 다운로드는 Android APK에서 실행할 수 있습니다.');return}
    setBusy(true);
    try{await enqueueDownload(result.url,safeFilenameFromUrl(result.url),settings.wifiOnly);setUrl('');setNotice('Android 다운로드 작업을 추가했습니다.');setScreen('downloads');await refresh();}
    catch(e){setNotice(`추가 실패: ${String(e)}`)}finally{setBusy(false)}
  };
  const cancel=async(id:string)=>{try{await cancelDownload(id);await refresh()}catch(e){setNotice(`취소 실패: ${String(e)}`)}};
  const retry=async(task:DownloadItem)=>{
    if(retryingId!==null)return;
    setRetryingId(task.id);
    try{const result=await retryDownload(task.id,settings.wifiOnly);await refresh();setNotice(result.reused?'기존 재시도 작업을 표시합니다.':'다운로드 재시도 작업을 등록했습니다.');}
    catch(e){
      const code=String(e);
      if(code.includes('RETRY_KEY_UNAVAILABLE')||code.includes('RETRY_CIPHERTEXT_UNREADABLE')){
        setNotice('저장된 링크의 암호화 키가 없거나 손상되어 재시도할 수 없습니다. 홈에서 링크를 다시 입력해 주세요. 기존 기록과 파일은 보존됩니다.');
        setScreen('home');
      }else{setNotice('다운로드 재시도에 실패했습니다. ('+code+')');}
    }finally{setRetryingId(null);}
  };
  const addWatch=()=>{
    const text=watchInput.trim();const valid=validateFileUrl(text);
    if(!valid.valid){setNotice(valid.message);return}
    if(!['pawchive.pw','cum.st'].some(host=>new URL(valid.url).hostname===host)){setNotice('관심 작가는 Pawchive 또는 Cum.st URL을 등록해 주세요.');return}
    if(watchlist.includes(valid.url)){setNotice('이미 등록된 주소입니다.');return}
    setWatchlist([valid.url,...watchlist]);setWatchInput('');setNotice('관심 주소를 저장했습니다. 새 게시물 자동 조회는 후속 단계입니다.');
  };
  const shownTasks=useMemo(()=>tasks.filter(t=>(queueFilter==='all'||t.status===queueFilter) && `${t.filename} ${t.url}`.toLowerCase().includes(search.toLowerCase())),[tasks,queueFilter,search]);
  return <div className="app-frame"><aside className="side-nav"><div className="brand"><Logo/><div><b>Pawchive</b><span>MOBILE <em>M7 ALPHA</em></span></div></div>
    <div className="nav-caption">WORKSPACE</div><nav>{navigation.map(({key,name,icon:Icon})=><button key={key} className={'nav-link '+(screen===key?'selected':'')} onClick={()=>setScreen(key)}><Icon size={19}/><span>{name}</span>{key==='downloads'&&active>0&&<i>{active}</i>}</button>)}</nav>
    <div className="side-bottom"><div className="side-promo"><div className="promo-shine"><Sparkles size={18}/></div><b>나만의 미디어 라이브러리</b><p>원하는 자료를 더 간편하게 관리하세요.</p></div><div className="side-version">v0.7.0 · M7 알파</div></div>
  </aside>
  <div className="main-column"><header className="topbar"><div className="topbar-left"><div className="topbar-caption">PERSONAL MEDIA MANAGER</div><div className="topbar-path">Pawchive <ChevronRight size={14}/> {navigation.find(n=>n.key===screen)?.name}</div></div><div className="top-actions"><span className={'environment '+(native?'connected':'demo')}><span className="tiny-pulse"/>{native?'Android 네이티브':'웹 미리보기'}</span><button className="header-circle" title="다운로드 화면으로 이동" onClick={()=>setScreen('downloads')}><Bell size={19}/>{active>0&&<span className="unread"/>}</button><div className="avatar">P</div></div></header>
  <main className="main-content">
    {screen==='home'&&<>
      <section className="hero"><div className="hero-content"><div className="hero-tag"><Sparkles size={14}/> NEW MOBILE EXPERIENCE</div><h1>당신의 콘텐츠,<br/><span>한곳에서 편리하게.</span></h1><p>링크 하나로 시작하는 다운로드와 라이브러리 관리.<br/>원하는 파일을 깔끔하고 빠르게 모아보세요.</p><button className="hero-action" onClick={()=>document.getElementById('link-input')?.focus()}><Plus size={17}/> 새 다운로드 시작 <ArrowRight size={17}/></button></div><div className="hero-art" aria-hidden="true"><span className="orbit orbit-a"/><span className="orbit orbit-b"/><div className="hero-illustration"><HardDriveDownload size={62} strokeWidth={1.4}/></div><span className="floating-icon floating-1"><Images size={19}/></span><span className="floating-icon floating-2"><FileArchive size={21}/></span><span className="floating-icon floating-3"><Check size={20}/></span></div></section>
      <div className="stats-grid"><div className="stat-card"><div className="stat-icon purple"><Download size={20}/></div><div><span>전체 다운로드</span><strong>{downloads.length}</strong></div><span className="stat-label">실제 작업</span></div><div className="stat-card"><div className="stat-icon cyan"><Activity size={20}/></div><div><span>진행 / 대기</span><strong>{active}</strong></div><span className="stat-label">실시간</span></div><div className="stat-card"><div className="stat-icon mint"><CheckCircle2 size={20}/></div><div><span>완료된 파일</span><strong>{completed}</strong></div><span className="stat-label">누적</span></div><div className="stat-card"><div className="stat-icon pink"><Heart size={20}/></div><div><span>관심 작가</span><strong>{watchlist.length}</strong></div><span className="stat-label">등록됨</span></div></div>
      <section className="surface-card link-card"><SectionHeading eyebrow="QUICK DOWNLOAD" title="새 다운로드"><span className="support-chip"><ShieldCheck size={14}/> HTTPS 전용</span></SectionHeading><div className="input-row"><div className="text-input-field"><Link2 size={19}/><input id="link-input" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void addDownload()}} placeholder="https://example.com/media/file.zip" aria-label="직접 파일 다운로드 URL"/></div><button className="primary-button" disabled={busy} onClick={()=>void addDownload()}><ArrowDownToLine size={18}/>{busy?'추가 중...':'다운로드 추가'}</button></div><p className="hint"><Info size={15}/> 직접 HTTPS 파일 다운로드입니다. 작가·게시물 링크는 '작가 탐색' 메뉴에서 분석하세요.</p></section>
      <div className="feature-row"><button className="mini-banner" onClick={()=>setScreen('explore')}><div className="mini-banner-icon"><Search size={22}/></div><div><b>작가·게시물 분석</b><p>작가 URL을 분석하고 첨부 파일 선택</p></div><ChevronRight size={18}/></button></div>
      <section className="surface-card recent-card"><SectionHeading eyebrow="YOUR ACTIVITY" title="최근 다운로드"><button className="ghost-link" onClick={()=>setScreen('downloads')}>전체 보기 <ArrowRight size={16}/></button></SectionHeading>{tasks.length?tasks.slice(0,3).map(t=><DownloadCard key={t.id} task={t} onCancel={id=>void cancel(id)} onRetry={t=>void retry(t)} retrying={retryingId===t.id}/>):<Empty icon={Download} title="아직 다운로드가 없습니다" description="Android APK에서 실제 다운로드를 추가하거나 샘플 항목으로 화면을 미리 확인하세요." action={<button className="outline-button" onClick={()=>setShowExamples(true)}><Play size={15}/> 샘플 UI 보기</button>}/>}</section>
      <div className="feature-row"><div className="mini-banner" onClick={()=>setScreen('watchlist')} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')setScreen('watchlist')}}><div className="mini-banner-icon"><Heart size={22}/></div><div><b>관심 작가 관리</b><p>주소를 저장하고 쉽게 찾아보세요</p></div><ChevronRight size={18}/></div><div className="mini-banner" onClick={()=>setScreen('library')} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')setScreen('library')}}><div className="mini-banner-icon orange"><FolderOpen size={22}/></div><div><b>내 라이브러리</b><p>다운로드한 자료를 확인하세요</p></div><ChevronRight size={18}/></div></div>
    </>}
    {screen==='explore'&&<CreatorExplorer wifiOnly={settings.wifiOnly} onQueued={refresh}/>}
    {screen==='downloads'&&<><div className="page-header"><div><p className="eyebrow">DOWNLOAD CENTER</p><h1>다운로드 관리</h1><p>대기 중인 파일과 다운로드 상태를 확인하세요.</p></div><button className="primary-button" onClick={()=>setScreen('home')}><Plus size={18}/> 새 다운로드</button></div><section className="surface-card"><div className="filters"><div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="파일 검색..." aria-label="파일 검색" /></div><div className="filter-pills">{[{key:'all',label:'전체'},{key:'running',label:'진행 중'},{key:'success',label:'완료'},{key:'failed',label:'실패'}].map(f=><button key={f.key} className={'pill '+(queueFilter===f.key?'active':'')} onClick={()=>setQueueFilter(f.key)}>{f.label}</button>)}</div><button className="round-button" title="새로고침" onClick={()=>void refresh()}><RefreshCw size={18}/></button></div><div className="list-divider"/>{shownTasks.length?shownTasks.map(t=><DownloadCard key={t.id} task={t} onCancel={id=>void cancel(id)} onRetry={t=>void retry(t)} retrying={retryingId===t.id}/>):<Empty icon={ListFilter} title="표시할 다운로드가 없습니다" description="조건을 바꾸거나 새 파일을 추가해 주세요."/>}</section><div className="web-hint"><Info size={16}/>{native?'다운로드는 Android 시스템 DownloadManager가 처리합니다. 일시정지는 이 단계에서 지원하지 않습니다.':'웹 미리보기에서는 실제 네이티브 다운로드를 실행하지 않습니다.'}<button onClick={()=>setShowExamples(v=>!v)}>{showExamples?'샘플 숨기기':'샘플 항목 보기'}</button></div><BackgroundTransfers/><AdvancedTransfers/></>}
    {screen==='library'&&<LibraryView downloads={downloads} onChanged={refresh} onGoDownloads={()=>setScreen('downloads')}/>}
    {screen==='watchlist'&&<><div className="page-header"><div><p className="eyebrow">CREATOR WATCHLIST</p><h1>관심 작가</h1><p>관심 콘텐츠 출처를 저장하고 관리하세요.</p></div><span className="support-chip"><Heart size={15}/> {watchlist.length}개 등록</span></div><section className="surface-card"><SectionHeading title="주소 등록"/><div className="input-row"><div className="text-input-field"><Link2 size={19}/><input value={watchInput} onChange={e=>setWatchInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addWatch()}} placeholder="https://pawchive.pw/..." aria-label="관심 작가 주소" /></div><button className="primary-button" onClick={addWatch}><Plus size={17}/> 등록</button></div><p className="hint"><Info size={15}/> 이 단계에서는 URL만 로컬에 저장합니다. 게시물 추적, 자동 동기화는 아직 동작하지 않습니다.</p><div className="list-divider"/>{watchlist.length?watchlist.map(item=><div className="watch-item" key={item}><div className="watch-avatar"><Heart size={19}/></div><div className="watch-info"><b>{new URL(item).hostname}</b><span title={item}>{item}</span></div><button className="round-button" onClick={()=>setWatchlist(v=>v.filter(x=>x!==item))} title="목록에서 제거"><Trash2 size={17}/></button></div>):<Empty icon={Heart} title="등록된 작가가 없습니다" description="관심 있는 Pawchive 주소를 추가해 보세요."/>}</section></>}
    {screen==='settings'&&<><div className="page-header"><div><p className="eyebrow">PREFERENCES</p><h1>설정</h1><p>다운로드 환경과 앱 정보를 관리하세요.</p></div></div><section className="surface-card settings-panel"><SectionHeading title="네트워크 및 다운로드"/><div className="setting-row"><div className="setting-icon"><Wifi size={21}/></div><div><h3>Wi-Fi에서만 다운로드</h3><p>Android DownloadManager에 네트워크 제한을 전달합니다.</p></div><button className={'toggle '+(settings.wifiOnly?'enabled':'')} role="switch" aria-checked={settings.wifiOnly} aria-label="Wi-Fi 다운로드만 허용" onClick={()=>setSettings(s=>({...s,wifiOnly:!s.wifiOnly}))}><span/></button></div><div className="setting-row"><div className="setting-icon"><SlidersHorizontal size={21}/></div><div><h3>다운로드 속도 제한</h3><p>고급 다운로드 화면의 개별 작업에 적용됩니다</p></div><span className="coming">M6 실험적</span></div><div className="setting-row"><div className="setting-icon"><PauseCircle size={21}/></div><div><h3>일시정지 및 이어받기</h3><p>고급 다운로드 화면에서 Range 이어받기를 시험할 수 있습니다</p></div><span className="coming">M6 실험적</span></div></section><section className="surface-card settings-panel"><SectionHeading title="앱 정보"/><div className="setting-row"><div className="setting-icon"><Smartphone size={21}/></div><div><h3>실행 환경</h3><p>{native?'Android 네이티브 APK':'데스크톱 / 모바일 브라우저 미리보기'}</p></div><span className="coming">M6</span></div><div className="setting-row"><div className="setting-icon"><ShieldCheck size={21}/></div><div><h3>보안 정책</h3><p>HTTPS만 허용하며 쿠키 자동 추출은 구현하지 않았습니다.</p></div><CheckCircle2 size={20} className="green-icon"/></div><div className="setting-row"><div className="setting-icon"><ExternalLink size={21}/></div><div><h3>원본 프로젝트 출처</h3><p>whyamihere773 / Pawchive-Downloader v1.2.9</p></div><a className="round-button" href="https://github.com/whyamihere773/Pawchive-Downloader" target="_blank" rel="noopener noreferrer" aria-label="원본 저장소 열기"><ExternalLink size={17}/></a></div></section></>}
  </main><footer className="footer">Pawchive Mobile M6 · 개인·비상업적 연구용 프로토타입 <span>기존 Pawchive Downloader와 공식적으로 제휴한 제품이 아닙니다.</span></footer></div>
  <nav className="mobile-bottom-nav" aria-label="주요 메뉴">{navigation.map(({key,name,icon:Icon})=><button key={key} className={screen===key?'active':''} onClick={()=>setScreen(key)}><Icon size={20}/><span>{name}</span></button>)}</nav>
  {notice&&<div className="toast" role="status"><CircleAlert size={19}/><span>{notice}</span><button aria-label="알림 닫기" onClick={()=>setNotice('')}><X size={17}/></button></div>}
  </div>;
}
