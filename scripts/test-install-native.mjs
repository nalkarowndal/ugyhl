import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import cp from 'node:child_process';
const source=process.cwd();const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pawchive-m5-'));
try {
  for(const p of ['scripts','native/android','native/android/res/xml'])fs.mkdirSync(path.join(temp,p),{recursive:true});
  fs.copyFileSync(path.join(source,'scripts/install-native-plugin.mjs'),path.join(temp,'scripts/install-native-plugin.mjs'));
  for(const file of ['PawchiveDownloadsPlugin.java','PawchiveTransfersPlugin.java','TransferCore.java','DigestVerifier.java','UrlVault.java','GalleryPaths.java','PawchiveFileProvider.java','BackgroundJobPolicy.java','BackgroundProgressPolicy.java','BackgroundTransferStore.java','BackgroundTransferJobService.java','PawchiveBackgroundPlugin.java'])fs.copyFileSync(path.join(source,'native/android',file),path.join(temp,'native/android',file));
  fs.copyFileSync(path.join(source,'native/android/res/xml/pawchive_file_paths.xml'),path.join(temp,'native/android/res/xml/pawchive_file_paths.xml'));
  const base=path.join(temp,'android/app/src/main'),java=path.join(base,'java/com/pawchive/mobile');fs.mkdirSync(java,{recursive:true});
  fs.writeFileSync(path.join(java,'MainActivity.java'),`package com.pawchive.mobile;\npublic class MainActivity extends BridgeActivity { @Override public void onCreate(android.os.Bundle savedInstanceState) { super.onCreate(savedInstanceState); } }`);
  fs.writeFileSync(path.join(base,'AndroidManifest.xml'),`<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:label="Pawchive"></application></manifest>`);
  for(let i=0;i<2;i++)cp.execFileSync('node',['scripts/install-native-plugin.mjs'],{cwd:temp,stdio:'pipe'});
  const activity=fs.readFileSync(path.join(java,'MainActivity.java'),'utf8'),manifest=fs.readFileSync(path.join(base,'AndroidManifest.xml'),'utf8');
  for(const name of ['PawchiveTransfersPlugin','PawchiveDownloadsPlugin','PawchiveBackgroundPlugin']){
    if(activity.split(`registerPlugin(${name}.class)`).length!==2)throw new Error('duplicate or missing plugin '+name);
  }
  if(manifest.split('BackgroundTransferJobService').length!==2)throw new Error('duplicate UIDT service');
  if(manifest.split('android.permission.RUN_USER_INITIATED_JOBS').length!==2)throw new Error('duplicate UIDT permission');
  if(manifest.split('PawchiveFileProvider').length!==2)throw new Error('duplicate FileProvider');
  if(manifest.split('android.permission.INTERNET').length!==2)throw new Error('duplicate INTERNET permission');
  if(!manifest.includes('${applicationId}.pawchive.files'))throw new Error('wrong FileProvider authority');
  if(!fs.existsSync(path.join(base,'res/xml/pawchive_file_paths.xml')))throw new Error('resource missing');
  console.log('PASS: M8 installer twice, provider, UIDT service and permissions');
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
