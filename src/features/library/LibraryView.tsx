import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle, Download, ExternalLink, File, FileAudio, FileVideo, Heart, Image as ImageIcon, Images, RefreshCw, Search, Trash2 } from 'lucide-react';
import type { DownloadItem } from '../../lib/types';
import { deleteDownloadFile, openDownloadedFile, requestThumbnail, runningOnAndroid, setDownloadFavorite } from '../../lib/native';
import { formatBytes } from '../../lib/url';
import { fileKind, libraryItems, type LibraryKind, type LibrarySort } from './library-utils';
import './library.css';

const kinds: { id:LibraryKind; label:string }[] = [
  {id:'all',label:'전체'},{id:'image',label:'이미지'},{id:'video',label:'동영상'},
  {id:'archive',label:'압축'},{id:'audio',label:'오디오'},{id:'other',label:'기타'}
];
const sortTypes: { id:LibrarySort; label:string }[] = [
  {id:'newest',label:'최신순'},{id:'oldest',label:'오래된순'},
  {id:'name',label:'이름순'},{id:'size',label:'용량순'}
];

function ItemIcon({name}:{name:string}){
  const kind=fileKind(name);
  if(kind==='image')return <ImageIcon size={27}/>;
  if(kind==='video')return <FileVideo size={27}/>;
  if(kind==='archive')return <Archive size={27}/>;
  if(kind==='audio')return <FileAudio size={27}/>;
  return <File size={27}/>;
}

function LibraryTile({ item, onOpen, onFavorite, onDelete }: {
 item:DownloadItem;
 onOpen:(id:string)=>Promise<void>;
 onFavorite:(item:DownloadItem)=>Promise<void>;
 onDelete:(item:DownloadItem)=>Promise<void>;
}){
  const isImage = fileKind(item.filename)==='image';
  const [thumb,setThumb]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!runningOnAndroid()||!isImage)return;
    let active=true;
    setLoading(true);
    requestThumbnail(item.id).then(data=>{if(active)setThumb(data)}).catch(()=>{}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[item.id,isImage]);
  return <article className="library-tile">
    <button type="button" className="library-cover" title={item.filename+' 열기'} onClick={()=>void onOpen(item.id)}>
      {thumb?<img alt="" src={thumb} loading="lazy"/>:<span className="library-placeholder"><ItemIcon name={item.filename}/>{loading?<small>미리보기 생성 중</small>:null}</span>}
      <span className="library-open-indicator"><ExternalLink size={15}/> 열기</span>
    </button>
    <div className="library-tile-text"><b title={item.filename}>{item.filename}</b><span>{formatBytes(item.totalBytes)} · {fileKind(item.filename)}</span></div>
    <div className="library-tile-actions">
      <button aria-label={item.filename+(item.favorite?' 즐겨찾기 해제':' 즐겨찾기 등록')} title="즐겨찾기" className={item.favorite?'liked':''} onClick={()=>void onFavorite(item)}><Heart size={18} fill={item.favorite?'currentColor':'none'}/></button>
      <button aria-label={item.filename+' 삭제'} title="파일 및 다운로드 기록 삭제" onClick={()=>void onDelete(item)}><Trash2 size={18}/></button>
    </div>
  </article>;
}
export function LibraryView({ downloads, onChanged, onGoDownloads }: {
  downloads:DownloadItem[];
  onChanged:()=>Promise<void>;
  onGoDownloads:()=>void;
}){
  const [query,setQuery]=useState('');
  const [kind,setKind]=useState<LibraryKind>('all');
  const [sort,setSort]=useState<LibrarySort>('newest');
  const [favoritesOnly,setFavoritesOnly]=useState(false);
  const [message,setMessage]=useState('');
  const items=useMemo(()=>libraryItems(downloads,{query,kind,sort,favoriteOnly:favoritesOnly}),[downloads,query,kind,sort,favoritesOnly]);
  const total=downloads.filter(d=>d.status==='success'&&!d.sample);
  const totalBytes=total.reduce((sum,t)=>sum+Math.max(0,t.totalBytes),0);
  const onOpen=useCallback(async(id:string)=>{
    try{await openDownloadedFile(id)}catch(e){setMessage('파일을 열지 못했습니다: '+String(e))}
  },[]);
  const onFavorite=useCallback(async(item:DownloadItem)=>{
    try{await setDownloadFavorite(item.id,!item.favorite);await onChanged()}
    catch(e){setMessage('즐겨찾기를 변경하지 못했습니다: '+String(e))}
  },[onChanged]);
  const onDelete=useCallback(async(item:DownloadItem)=>{
    if(!window.confirm(`"${item.filename}" 파일과 다운로드 기록을 영구 삭제할까요?`))return;
    try{await deleteDownloadFile(item.id);await onChanged();setMessage('선택한 파일과 기록을 삭제했습니다.')}
    catch(e){setMessage('삭제 실패: '+String(e))}
  },[onChanged]);
  return <div className="library-page">
    <header className="page-header"><div><p className="eyebrow">YOUR ARCHIVE · M5</p><h1>내 보관함</h1><p>Android 기기에 실제로 다운로드된 파일만 표시합니다.</p></div><button className="outline-button" onClick={()=>void onChanged()}><RefreshCw size={16}/> 새로고침</button></header>
    <section className="library-totals">
      <div><span>완료한 다운로드</span><strong>{total.length}개</strong></div>
      <div><span>보관 용량</span><strong>{formatBytes(totalBytes)}</strong></div>
      <div><span>즐겨찾기</span><strong>{total.filter(t=>t.favorite).length}개</strong></div>
    </section>
    <section className="surface-card library-section">
      <div className="library-toolbar"><label className="library-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="파일 이름 검색" aria-label="보관함 파일 검색"/></label><select aria-label="정렬" value={sort} onChange={e=>setSort(e.target.value as LibrarySort)}>{sortTypes.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
      <div className="library-filterline"><div className="library-chips">{kinds.map(k=><button key={k.id} className={kind===k.id?'active':''} onClick={()=>setKind(k.id)}>{k.label}</button>)}</div><button className={favoritesOnly?'library-star-filter active':'library-star-filter'} onClick={()=>setFavoritesOnly(v=>!v)} aria-pressed={favoritesOnly}><Heart size={15}/> 즐겨찾기만</button></div>
      {message&&<div className="library-message" role="status"><CheckCircle size={16}/>{message}<button onClick={()=>setMessage('')} aria-label="메시지 닫기">×</button></div>}
      {!runningOnAndroid()?<div className="empty-state"><Images size={28}/><h3>웹에서는 보관함을 읽을 수 없습니다</h3><p>다운로드 목록과 미리보기는 Android APK를 실행하면 표시됩니다. 허위 샘플은 사용하지 않습니다.</p></div>:
       items.length===0?<div className="empty-state"><Images size={28}/><h3>표시할 파일이 없습니다</h3><p>{total.length?'검색 또는 필터 조건을 바꿔보세요.':'다운로드를 완료한 뒤 이곳에서 확인할 수 있습니다.'}</p><button className="outline-button" onClick={onGoDownloads}><Download size={15}/> 다운로드 관리</button></div>:
       <div className="library-grid">{items.map(item=><LibraryTile key={item.id} item={item} onOpen={onOpen} onFavorite={onFavorite} onDelete={onDelete}/>)}</div>}
      <p className="library-footnote">보관함은 Android 기본 다운로드와 M4 고급 엔진의 완료 파일을 표시합니다. 다른 앱의 파일은 임의로 검색하지 않습니다.</p>
    </section>
  </div>;
}
