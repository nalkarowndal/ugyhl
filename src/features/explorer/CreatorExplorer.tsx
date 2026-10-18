import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckSquare, Download, ExternalLink, FolderSearch, Image, LoaderCircle, Search, Square } from 'lucide-react';
import { runningOnAndroid, enqueueDownload } from '../../lib/native';
import { safeFilenameFromUrl } from '../../lib/url';
import { fetchCreatorPage, parseCreatorTarget, type CreatorPost, type CreatorTarget, type MediaKind } from '../../lib/pawchive';
import './explorer.css';

type KindFilter = 'all' | MediaKind;
const kinds: {key:KindFilter,label:string}[] = [
  {key:'all',label:'전체'},{key:'image',label:'이미지'},{key:'video',label:'영상'},{key:'archive',label:'압축'},{key:'audio',label:'오디오'},{key:'other',label:'기타'}
];
function safeFileName(name:string,url:string):string {
  const raw=name.replace(/[\\/\u0000-\u001f:*?"<>|]/g,'_').replace(/^\.+/,'').trim();
  return raw.slice(0,110) || safeFilenameFromUrl(url);
}
export function CreatorExplorer({wifiOnly,onQueued}:{wifiOnly:boolean,onQueued:()=>Promise<void>}){
  const [input,setInput] = useState('');
  const [target,setTarget] = useState<CreatorTarget|null>(null);
  const [posts,setPosts] = useState<CreatorPost[]>([]);
  const [page,setPage] = useState(0);
  const [selected,setSelected] = useState<Set<string>>(new Set());
  const [filter,setFilter] = useState<KindFilter>('all');
  const [busy,setBusy] = useState(false);
  const [queueing,setQueueing] = useState(false);
  const [message,setMessage] = useState('');
  const files = useMemo(()=>posts.flatMap(post=>post.attachments.map(file=>({...file,postTitle:post.title}))),[posts]);
  const available = useMemo(()=>files.filter(file=>Boolean(file.url) && (filter==='all' || file.kind===filter)),[files,filter]);
  const checked = available.filter(item=>selected.has(item.key));
  async function load(next:CreatorTarget,nextPage:number){
    setBusy(true);setMessage('');setSelected(new Set());setPosts([]);
    try{
      const result=await fetchCreatorPage(next,nextPage);
      setTarget(next);setPage(nextPage);setPosts(result);
      if (!result.length) setMessage('이 페이지에 게시물이 없습니다.');
      else if (!result.some(p=>p.attachments.some(f=>f.url)))setMessage('표시할 수 있는 다운로드 링크가 없습니다. 지연 파일은 후속 단계에서 지원합니다.');
    }catch(error){setTarget(next);setPage(nextPage);setMessage(error instanceof Error?error.message:'조회에 실패했습니다.');}
    finally{setBusy(false)}
  }
  function submit(){try{void load(parseCreatorTarget(input),0)}catch(error){setMessage(error instanceof Error?error.message:'주소를 확인해 주세요.')}}
  function toggle(id:string){setSelected(old=>{const next=new Set(old);next.has(id)?next.delete(id):next.add(id);return next})}
  function togglePage(){setSelected(old=>{const next=new Set(old);const all=available.every(f=>next.has(f.key));for(const f of available)all?next.delete(f.key):next.add(f.key);return next})}
  async function downloadSelected(){
    if(!runningOnAndroid()){setMessage('웹 브라우저에서는 목록 검수만 지원합니다. 실제 다운로드는 Android APK에서 실행할 수 있습니다.');return}
    if(checked.length===0){setMessage('먼저 파일을 선택해 주세요.');return}
    setQueueing(true);let ok=0;let errors=0;
    for(const file of checked){
      try{if(file.url){await enqueueDownload(file.url,safeFileName(file.name,file.url),wifiOnly);ok++}}catch{errors++}
    }
    setQueueing(false);setMessage(`${ok}개 작업이 Android 대기열에 등록되었습니다.${errors?` 실패 ${errors}개`:''}`);
    await onQueued();
  }
  return <div className="explorer-page">
    <div className="page-header"><div><p className="eyebrow">CREATOR EXPLORER · M2</p><h1>작가 · 게시물 분석</h1><p>Pawchive와 Cum.st에서 접근 가능한 게시물의 첨부 파일을 선택하세요.</p></div><span className="support-chip"><FolderSearch size={15}/> 실서버 조회</span></div>
    <section className="surface-card"><div className="explorer-search"><div className="text-input-field"><Search size={18}/><input aria-label="작가 또는 게시물 URL" value={input} placeholder="https://pawchive.pw/patreon/user/12345" onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')submit()}}/></div><button className="primary-button" disabled={busy||queueing} onClick={submit}>{busy?<LoaderCircle className="spinning" size={17}/>:<Search size={17}/>} 분석</button></div>
      <p className="hint">공식 서비스의 접근 제한을 우회하지 않습니다. 로그인 콘텐츠, 만료된 임시 링크, 페이지별 접근 제한은 별도 지원이 필요합니다.</p>
      {target&&<div className="explorer-source"><span>대상: <b>{target.host} / {target.service} / {target.creatorId}</b></span><a href={target.displayUrl} target="_blank" rel="noopener noreferrer">게시물 열기 <ExternalLink size={13}/></a></div>}
      {message&&<div role="status" className="explorer-message"><AlertTriangle size={16}/><span>{message}</span></div>}
      {target&&!target.postId&&<div className="explorer-paging"><button className="outline-button" disabled={busy||page===0} onClick={()=>void load(target,page-1)}><ArrowLeft size={15}/> 이전</button><span>{page+1} 페이지</span><button className="outline-button" disabled={busy||posts.length===0} onClick={()=>void load(target,page+1)}>다음 <ArrowRight size={15}/></button></div>}
    </section>
    {target&&<section className="surface-card explorer-results"><div className="explorer-topline"><div><p className="eyebrow">SCAN RESULTS</p><h2>{posts.length}개 게시물 · {files.length}개 첨부 파일</h2></div><button className="primary-button" disabled={queueing||busy||checked.length===0} onClick={()=>void downloadSelected()}><Download size={17}/>{queueing?'등록 중...':`${checked.length}개 다운로드`}</button></div>
      <div className="explorer-filterbar"><div className="filter-pills">{kinds.map(k=><button key={k.key} className={'pill '+(filter===k.key?'active':'')} onClick={()=>setFilter(k.key)}>{k.label}</button>)}</div><button className="outline-button" onClick={togglePage} disabled={available.length===0}><CheckSquare size={15}/> 현재 필터 전체 선택</button></div>
      {posts.map(post=><article className="explorer-post" key={post.id}><div className="explorer-post-head"><div><h3>{post.title}</h3><span>게시물 #{post.id} {post.published&&`· ${post.published.slice(0,10)}`}</span></div><span className="sample-chip">{post.attachments.length}개 파일</span></div><div className="explorer-files">{post.attachments.filter(f=>filter==='all'||f.kind===filter).map(f=><button type="button" key={f.key} className={'explorer-file '+(!f.url?'disabled':'')} disabled={!f.url} onClick={()=>toggle(f.key)} aria-pressed={selected.has(f.key)}>{selected.has(f.key)?<CheckSquare size={19}/>:<Square size={19}/>}<Image size={17}/><span title={f.name}>{f.name}</span><small>{f.url?f.kind:'사용 불가 · 임시 링크'}</small></button>)}</div></article>)}
      {posts.length===0&&<div className="empty-state"><FolderSearch size={28}/><h3>표시할 게시물이 없습니다</h3><p>주소를 확인하고 다시 조회해 주세요.</p></div>}
      <p className="hint">현재 페이지의 파일만 선택합니다. 외부 스트리밍 영상 변환·만료 링크 재생성은 아직 구현하지 않았습니다.</p>
    </section>}
  </div>
}
