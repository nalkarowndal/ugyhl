#!/usr/bin/env node
/* M9.1: Debug-only WebView DOM and Chromium screenshot diagnostics.
   No URLs, cookies or downloaded content are included in output. */
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='qa-output';
mkdirSync(out,{recursive:true});
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:12000}).trim();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const save=o=>writeFileSync(out+'/webview-diagnostics.json',JSON.stringify(o,null,2)+'\n');
let page,lastError='';
for(let i=0;i<15;i++){
 try{
  const pid=adb('shell','pidof','com.pawchive.mobile').split(/\s+/)[0];
  if(!/^\d+$/.test(pid))throw Error('App process not found');
  adb('forward','tcp:19223','localabstract:webview_devtools_remote_'+pid);
  const res=await fetch('http://127.0.0.1:19223/json',{signal:AbortSignal.timeout(2500)});
  if(!res.ok)throw Error('DevTools HTTP status '+res.status);
  page=(await res.json()).find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
  if(page)break;
  throw Error('No WebView page exposed');
 }catch(e){lastError=String(e.message||e).slice(0,200);await wait(1000);}
}
if(!page){save({result:'unavailable',reason:lastError});console.error('CDP unavailable:',lastError);process.exit(2)}
const ws=new WebSocket(page.webSocketDebuggerUrl);
const pending=new Map();const exceptions=[];let id=0;
ws.addEventListener('message',e=>{
 try{
  const m=JSON.parse(e.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}
  if(m.method==='Runtime.exceptionThrown'){
   const d=m.params?.exceptionDetails;
   exceptions.push({line:d?.lineNumber??-1,message:String(d?.text||'JS_EXCEPTION').slice(0,160)});
  }
 }catch{}
});
await Promise.race([
 new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',()=>j(Error('WebSocket error')),{once:true})}),
 wait(6000).then(()=>{throw Error('CDP connection timeout')})
]);
async function command(method,params={}){
 const n=++id;
 const reply=new Promise((resolve,reject)=>{
  pending.set(n,resolve);
  setTimeout(()=>{if(pending.has(n)){pending.delete(n);reject(Error('CDP command timeout: '+method))}},6500);
 });
 ws.send(JSON.stringify({id:n,method,params}));
 return await reply;
}
await command('Runtime.enable');
const expression=String.raw`(() => {
 const root=document.getElementById('root');
 const frame=document.querySelector('.app-frame');
 const hero=document.querySelector('.hero');
 const cs=frame?getComputedStyle(frame):null;
 const rect=frame?.getBoundingClientRect();
 return {readyState:document.readyState,rootFound:!!root,
  rootChildren:root?.children.length??0,rootTextLength:root?.textContent?.trim().length??0,
  frameFound:!!frame,heroFound:!!hero,frameBackground:cs?.backgroundColor??'',
  frameDisplay:cs?.display??'',frameVisibility:cs?.visibility??'',
  frameWidth:Math.round(rect?.width??0),frameHeight:Math.round(rect?.height??0),
  viewportWidth:innerWidth,viewportHeight:innerHeight,
  documentHidden:document.hidden};
})()`;
let dom={};let screenshot='not-captured';
try{
 const reply=await command('Runtime.evaluate',{expression,returnByValue:true});
 dom=reply.result?.result?.value || {};
 await command('Page.enable');
 const shot=await command('Page.captureScreenshot',{format:'png',fromSurface:true});
 if(shot.result?.data){
  writeFileSync(out+'/webview-cdp.png',Buffer.from(shot.result.data,'base64'));
  screenshot='saved';
 }
}catch(e){screenshot='error';exceptions.push({message:String(e.message||e).slice(0,180)})}
// Prove real React navigation, not just a static screenshot. No file/network actions.
let nav={downloads:false,home:false};
try{
 await command('Runtime.evaluate',{expression:"Array.from(document.querySelectorAll('nav .nav-link')).find(b=>b.textContent.includes('다운로드'))?.click()",returnByValue:true});
 await wait(300);
 const selected=await command('Runtime.evaluate',{expression:"document.querySelector('nav .nav-link.selected')?.textContent?.trim() || ''",returnByValue:true});
 nav.downloads=String(selected.result?.result?.value || '').includes('다운로드');
 await command('Runtime.evaluate',{expression:"Array.from(document.querySelectorAll('nav .nav-link')).find(b=>b.textContent.includes('홈'))?.click()",returnByValue:true});
 await wait(300);
 const home=await command('Runtime.evaluate',{expression:"document.querySelector('nav .nav-link.selected')?.textContent?.trim() || ''",returnByValue:true});
 nav.home=String(home.result?.result?.value || '').includes('홈');
}catch(e){exceptions.push({message:'navigation test failed: '+String(e.message||e).slice(0,110)})}
ws.close();
save({result:'inspected',dom,exceptions:exceptions.slice(0,10),cdpScreenshot:screenshot,navigation:nav});
console.log('M9.1 WebView structural diagnostics:',JSON.stringify(dom));
if(!dom.frameFound||dom.rootTextLength<80||dom.frameWidth<=0||dom.frameDisplay==='none'||!nav.downloads||!nav.home){
 console.error('FAIL: WebView React root not rendered/visible');
 process.exit(1);
}
console.log('PASS: React DOM exists with layout (OS screenshot still required)');
