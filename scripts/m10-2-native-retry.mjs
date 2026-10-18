#!/usr/bin/env node
/* Android emulator QA. No URLs or encryption keys are printed or persisted. */
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
const id=process.argv[2], mode=process.argv[3];
if(!/^[0-9]+$/.test(id)||!['success','RETRY_CIPHERTEXT_UNREADABLE','RETRY_KEY_UNAVAILABLE'].includes(mode))throw Error('Invalid args');
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:15000}).trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let target;
for(let i=0;i<20;i++){
 try{
  const pid=adb('shell','pidof','com.pawchive.mobile').split(/\s+/)[0];
  if(!/^\d+$/.test(pid))throw Error('Process unavailable');
  adb('forward','tcp:19224','localabstract:webview_devtools_remote_'+pid);
  const r=await fetch('http://127.0.0.1:19224/json',{signal:AbortSignal.timeout(2500)});
  target=(await r.json()).find(p=>p.type==='page'&&p.webSocketDebuggerUrl);
  if(target)break;
 }catch{}
 await sleep(800);
}
if(!target)throw Error('CDP WebView target not found');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await Promise.race([
 new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true})}),
 sleep(7000).then(()=>{throw Error('CDP WebSocket timeout')})
]);
const expr='(async()=>{try{const p=window.Capacitor?.Plugins?.PawchiveDownloads;if(!p) return {ok:false,code:"PLUGIN_UNAVAILABLE"};const x=await p.retry({id:"'+id+'",wifiOnly:false});return {ok:true,id:String(x.id)};}catch(e){return {ok:false,code:String(e?.message||e).slice(0,90)};}})()';
const reply=new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(Error('CDP native reply timeout')),24000);
 ws.addEventListener('message',function cb(ev){
  const m=JSON.parse(ev.data);
  if(m.id!==10)return;
  clearTimeout(timeout);ws.removeEventListener('message',cb);resolve(m);
 });
});
ws.send(JSON.stringify({id:10,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true}}));
const data=(await reply).result?.result?.value;
ws.close();
if(!data||typeof data.ok!=='boolean')throw Error('Native plugin result not available');
const out={ok:data.ok,mode:mode,code:data.ok?'SUCCESS':data.code};
if(data.ok && !/^[0-9]+$/.test(data.id||''))throw Error('Native enqueue ID not numeric');
if(data.ok)out.id=data.id;
mkdirSync('qa-output/m10-migration',{recursive:true});
writeFileSync('qa-output/m10-migration/native-retry-'+mode+'.json',JSON.stringify(out,null,2)+'\n');
if(mode==='success'){if(!data.ok)throw Error('Expected retry success; got '+data.code);}
else if(data.ok||data.code!==mode)throw Error('Expected '+mode+', received '+(data.ok?'success':data.code));
console.log('PASS: native retry result '+out.code+'; no original URL exposed');
