import { describe, expect, it } from 'vitest';
import { fileKind, libraryItems } from './library-utils';
import type { DownloadItem } from '../../lib/types';
const item = (id:string, filename:string, status:DownloadItem['status'], createdAt:number, favorite=false):DownloadItem =>
  ({ id, filename, status, createdAt, favorite, totalBytes:createdAt, bytesDownloaded:createdAt, url:'https://cdn.example.com/'+filename });
describe('library indexing',()=>{
  it('classifies media by extension case-insensitively',()=>{
    expect(fileKind('IMG.PNG')).toBe('image');expect(fileKind('a.MP4')).toBe('video');
    expect(fileKind('data.7Z')).toBe('archive');expect(fileKind('song.FLAC')).toBe('audio');
    expect(fileKind('other.bin')).toBe('other');
  });
  const list=[item('1','b.PNG','success',200,true),item('2','a.mp4','success',100),item('3','pending.jpg','running',50),item('4','x.PNG','success',300),{...item('5','sample.png','success',400),sample:true}];
  it('never lists incomplete or sample items',()=>{
    expect(libraryItems(list,{}).map(t=>t.id)).toEqual(['4','1','2']);
  });
  it('filters by file kind, favorites, query',()=>{
    expect(libraryItems(list,{kind:'image',favoriteOnly:true}).map(t=>t.id)).toEqual(['1']);
    expect(libraryItems(list,{query:'A.MP4'}).map(t=>t.id)).toEqual(['2']);
  });
  it('supports deterministic name and size sorting',()=>{
    expect(libraryItems(list,{sort:'name'}).map(t=>t.id)).toEqual(['2','1','4']);
    expect(libraryItems(list,{sort:'size'}).map(t=>t.id)).toEqual(['4','1','2']);
  });
});
