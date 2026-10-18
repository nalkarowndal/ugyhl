#!/usr/bin/env node
/* Debug emulator: exercise real Capacitor FileProvider/gallery via synthetic PNG. */
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const mode=process.argv[2];
if(!['thumbnail','open','delete'].includes(mode))throw Error('Gallery test action required');
const id='m4:00000000-0000-4000-8000-000000000003';
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:15000}).trim();
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
let target;
for(let i=0;i<20;i++){
  try {
    const pid=adb('shell','pidof','com.pawchive.mobile').split(/\s+/)[0];
    if(!/^\d+$/.test(pid))throw Error('App not running');
    adb('forward','tcp:19226','localabstract:webview_devtools_remote_'+pid);
    const result=await fetch('http://127.0.0.1:19226/json',{signal:AbortSignal.timeout(2500)});
    target=(await result.json()).find(p=>p.type==='page'&&p.webSocketDebuggerUrl);
    if(target)break;
  }catch{}
  await sleep(700);
}
if(!target)throw Error('WebView CDP unavailable');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await Promise.race([
  new Promise((done,fail)=>{ws.addEventListener('open',done,{once:true});ws.addEventListener('error',fail,{once:true})}),
  sleep(7000).then(()=>{throw Error('CDP connect timeout')})
]);
const method=JSON.stringify(mode),record=JSON.stringify(id);
const expr='(async()=>{try{const p=window.Capacitor?.Plugins?.PawchiveDownloads;'+
 'if(!p)return {ok:false,code:"PLUGIN_UNAVAILABLE"};'+
 'const r=await p['+method+']({id:'+record+'});'+
 'return {ok: '+(mode==='thumbnail'?'typeof r.dataUrl==="string" && r.dataUrl.startsWith("data:image/jpeg;base64,") && r.dataUrl.length>130':'r.success===true')+'};'+
 '}catch(e){return {ok:false,code:String(e?.message||e).slice(0,120)}}})()';
const message=await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Native gallery action timeout')),24000);
  ws.addEventListener('message',function receive(event){
    const m=JSON.parse(event.data);
    if(m.id!==21)return;
    clearTimeout(timeout);
    ws.removeEventListener('message',receive);
    resolve(m);
  });
  ws.send(JSON.stringify({id:21,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true}}));
});
ws.close();
const value=message.result?.result?.value || {ok:false,code:'CDP_RESULT_MISSING'};
mkdirSync('qa-output/m10-migration',{recursive:true});
writeFileSync('qa-output/m10-migration/gallery-'+mode+'.json',
 JSON.stringify({mode,passed:value.ok===true,code:value.ok?'PASS':value.code},null,2)+'\n');
if(value.ok!==true)throw Error('Gallery '+mode+' failed: '+String(value.code));
console.log('PASS: native gallery '+mode+' with synthetic app-owned PNG');
