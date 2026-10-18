import { describe,expect,it } from 'vitest';
import { parseCreatorTarget,apiUrl,downloadUrl,normalizePosts,getMediaKind } from './pawchive';
describe('Pawchive URL parser',()=>{
  it('accepts user and post routes',()=>{
    const p = parseCreatorTarget('https://pawchive.pw/patreon/user/123/post/456');
    expect(p.creatorId).toBe('123');expect(p.postId).toBe('456');
    expect(apiUrl(p)).toContain('/api/v1/patreon/user/123/post/456');
  });
  it('supports alternate artists path and paging',()=>{
    const p = parseCreatorTarget('https://cum.st/artists/fansly/442');
    expect(apiUrl(p,2)).toBe('https://cum.st/api/v1/fansly/user/442/posts?o=100&n=50');
  });
  it('converts legacy Kemono to supported Pawchive domain',()=>{
    expect(parseCreatorTarget('https://kemono.cr/patreon/user/2').host).toBe('pawchive.pw');
  });
  it.each(['http://pawchive.pw/patreon/user/1','https://pawchive.pw.evil.test/patreon/user/1','https://admin@pawchive.pw/patreon/user/1','https://pawchive.pw/patreon/user/1?token=SECRET','https://pawchive.pw/patreon/user/../2','https://pawchive.pw/'])('rejects unsafe/unsupported URL %s',url=>{expect(()=>parseCreatorTarget(url)).toThrow();});
});
describe('Pawchive data normalization',()=>{
  const target = parseCreatorTarget('https://pawchive.pw/patreon/user/77');
  it('picks files and attachments and removes duplicates',()=>{
    const posts=normalizePosts([{id:'5',title:'Test',file:{name:'cover.png',path:'/abc.png'},attachments:[{name:'zip.zip',path:'https://cdn.example.com/x.zip'},{name:'cover.png',path:'/abc.png'}]}],target);
    expect(posts).toHaveLength(1);expect(posts[0].attachments).toHaveLength(2);
    expect(posts[0].attachments[0].kind).toBe('image');
  });
  it('marks missing deferred downloads unavailable',()=>{
    const posts=normalizePosts({post:{id:5,attachments:[{name:'wait.zip',deferred:true}]}},target);
    expect(posts[0].attachments[0]).toMatchObject({deferred:true,url:undefined});
  });
  it('rejects local/http download URLs',()=>{
    expect(downloadUrl('http://example.com/a.png',target)).toBeUndefined();
    expect(downloadUrl('https://127.0.0.1/a.zip',target)).toBeUndefined();
    expect(downloadUrl('https://localhost/a',target)).toBeUndefined();
    expect(downloadUrl('/files/abc',target)).toBe('https://pawchive.pw/files/abc');
  });
  it('infers media type',()=>expect(getMediaKind('x.mkv')).toBe('video'));
});
