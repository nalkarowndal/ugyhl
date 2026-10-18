#!/usr/bin/env node
/**
 * Real Android 15 Capacitor native-plugin acceptance test, invoked from
 * ephemeral emulator CI. All inputs are public test URLs, never credentials.
 */
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const phase=process.argv[2];
const phases=['seed-v3','check-upgrade','enqueue-https','poll-https','delete-https'];
if(!phases.includes(phase))throw Error('Invalid QA phase');
const out='qa-output/m10-4';
mkdirSync(out,{recursive:true});
const oldId=()=>JSON.parse(readFileSync(out+'/seed-v3.json','utf8')).id;
const liveId=()=>JSON.parse(readFileSync(out+'/enqueue-https.json','utf8')).id;
const pubUrl='https://raw.githubusercontent.com/nalkarowndal/ugyhl/0fa72305fe98a6519ed399d149afd0404b0281df/UPSTREAM_LICENSE.txt';
let action;
if(phase==='seed-v3'){
  action='const a=await p.enqueue({url:"https://example.invalid/m10-4-legacy?fake=1",filename:"m10-4-old.dat",wifiOnly:false});'+
    'await p.favorite({id:a.id,favorite:true}); return {ok:true,id:String(a.id)};';
}else if(phase==='check-upgrade'){
  action='const records=(await p.list()).downloads;const item=records.find(x=>x.id==='+JSON.stringify(oldId())+');'+
    'return {ok:!!item&&item.favorite===true&&item.url==="",id:item?.id||"",favorite:item?.favorite===true};';
}else if(phase==='enqueue-https'){
  action='const a=await p.enqueue({url:'+JSON.stringify(pubUrl)+',filename:"m10-4-license.txt",wifiOnly:false});return {ok:true,id:String(a.id)};';
}else if(phase==='poll-https'){
  action='const id='+JSON.stringify(liveId())+';for(let i=0;i<55;i++){'+
    'const item=(await p.list()).downloads.find(x=>x.id===id);'+
    'if(item?.status==="success")return {ok:item.bytesDownloaded>0,id,status:item.status,bytes:item.bytesDownloaded,total:item.totalBytes};'+
    'if(item?.status==="failed")return {ok:false,status:item.status,reason:item.reason||""};'+
    'await new Promise(done=>setTimeout(done,2500));'+
    '}return {ok:false,status:"TIMEOUT"};';
}else{
  action='const id='+JSON.stringify(liveId())+';const d=await p.delete({id});'+
    'const remain=(await p.list()).downloads.some(x=>x.id===id);return {ok:d.success===true&&!remain,deleted:d.success===true,stillListed:remain};';
}
const expression='(async()=>{try{const p=window.Capacitor?.Plugins?.PawchiveDownloads;'+
 'if(!p)return {ok:false,code:"PLUGIN_UNAVAILABLE"};'+action+
 '}catch(e){return {ok:false,code:String(e?.message||e).slice(0,120)}}})()';
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:15000}).trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let tab;
for(let i=0;i<25;i++){
 try{
  const pid=adb('shell','pidof','com.pawchive.mobile').split(/\s+/)[0];
  if(!/^\d+$/.test(pid))throw Error('App not active');
  adb('forward','tcp:19229','localabstract:webview_devtools_remote_'+pid);
  const r=await fetch('http://127.0.0.1:19229/json',{signal:AbortSignal.timeout(2500)});
  tab=(await r.json()).find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
  if(tab)break;
 }catch{}
 await sleep(700);
}
if(!tab)throw Error('WebView DevTools not found');
const ws=new WebSocket(tab.webSocketDebuggerUrl);
await Promise.race([
 new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true})}),
 sleep(6000).then(()=>{throw Error('CDP connection timeout')})
]);
const reply=await new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(Error('CDP plugin response timeout')),180000);
 ws.addEventListener('message',function received(ev){
   const m=JSON.parse(ev.data);
   if(m.id!==48)return;
   clearTimeout(timeout);ws.removeEventListener('message',received);resolve(m);
 });
 ws.send(JSON.stringify({id:48,method:'Runtime.evaluate',params:{
   expression,awaitPromise:true,returnByValue:true
 }}));
});
ws.close();
const result=reply?.result?.result?.value||{ok:false,code:'CDP_ERROR'};
writeFileSync(out+'/'+phase+'.json',JSON.stringify(result,null,2)+'\n');
if(result.ok!==true)throw Error('M10.4 '+phase+' failed: '+JSON.stringify(result).slice(0,220));
console.log('PASS: M10.4 Android native '+phase+
  (result.bytes?' bytes='+result.bytes:'')+
  (result.status?' status='+result.status:''));
