import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const base = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'pawchive', 'mobile');
const plugin = path.join(root, 'native', 'android', 'PawchiveDownloadsPlugin.java');
if (!fs.existsSync(path.join(root, 'android'))) {
  console.error('Android project not found. First run: npx cap add android');
  process.exit(1);
}
fs.mkdirSync(base, { recursive: true });
fs.copyFileSync(plugin, path.join(base, 'PawchiveDownloadsPlugin.java'));
for (const name of ['TransferCore.java', 'DigestVerifier.java', 'PawchiveTransfersPlugin.java', 'UrlVault.java', 'GalleryPaths.java', 'PawchiveFileProvider.java', 'BackgroundJobPolicy.java', 'BackgroundTransferStore.java', 'BackgroundTransferJobService.java', 'PawchiveBackgroundPlugin.java']) {
  fs.copyFileSync(path.join(root, 'native','android',name), path.join(base,name));
}
const java = path.join(base, 'MainActivity.java');
const kotlin = path.join(base, 'MainActivity.kt');
if (fs.existsSync(java)) {
  let data = fs.readFileSync(java, 'utf8');
  for (const pluginClass of ['PawchiveDownloadsPlugin','PawchiveTransfersPlugin','PawchiveBackgroundPlugin']) {
  if (!data.includes(`registerPlugin(${pluginClass}.class)`)) {
    if (data.includes('super.onCreate(savedInstanceState);')) {
      data = data.replace(/super\.onCreate\(savedInstanceState\);/, `registerPlugin(${pluginClass}.class);\n    super.onCreate(savedInstanceState);`);
    } else {
      data = data.replace(/}\s*$/, `  @Override public void onCreate(android.os.Bundle savedInstanceState) {\n    registerPlugin(${pluginClass}.class);\n    super.onCreate(savedInstanceState);\n  }\n}`);
    }
  }
  }
  if (!data.includes('registerPlugin(PawchiveDownloadsPlugin.class)') || !data.includes('registerPlugin(PawchiveTransfersPlugin.class)') || !data.includes('registerPlugin(PawchiveBackgroundPlugin.class)')) throw new Error('Could not patch MainActivity.java');
  fs.writeFileSync(java, data);
} else if (fs.existsSync(kotlin)) {
  let data = fs.readFileSync(kotlin, 'utf8');
  for (const pluginClass of ['PawchiveDownloadsPlugin','PawchiveTransfersPlugin','PawchiveBackgroundPlugin']) {
  if (!data.includes(`registerPlugin(${pluginClass}::class.java)`)) {
    if (data.includes('super.onCreate(savedInstanceState)')) {
      data = data.replace('super.onCreate(savedInstanceState)', `registerPlugin(${pluginClass}::class.java)\n    super.onCreate(savedInstanceState)`);
    } else {
      data = data.replace(/}\s*$/, `  override fun onCreate(savedInstanceState: android.os.Bundle?) {\n    registerPlugin(${pluginClass}::class.java)\n    super.onCreate(savedInstanceState)\n  }\n}`);
    }
  }
  }
  if (!data.includes('registerPlugin(PawchiveDownloadsPlugin::class.java)') || !data.includes('registerPlugin(PawchiveTransfersPlugin::class.java)') || !data.includes('registerPlugin(PawchiveBackgroundPlugin::class.java)')) throw new Error('Could not patch MainActivity.kt');
  fs.writeFileSync(kotlin, data);
} else {
  throw new Error('MainActivity.java or MainActivity.kt not found in expected package. Check capacitor.config.ts appId.');
}
const manifestPath = path.join(root,'android','app','src','main','AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath,'utf8');
if (!manifest.includes('android.permission.INTERNET')) {
  manifest = manifest.replace('<application', '<uses-permission android:name="android.permission.INTERNET" />\n    <application');
  fs.writeFileSync(manifestPath, manifest);
}
// An Android FileProvider shares ONLY files from our app-specific M4 downloads folder.
const xmlDir = path.join(root,'android','app','src','main','res','xml');
fs.mkdirSync(xmlDir, {recursive:true});
fs.copyFileSync(path.join(root,'native','android','res','xml','pawchive_file_paths.xml'),path.join(xmlDir,'pawchive_file_paths.xml'));
const providerBlock = `    <provider android:name="com.pawchive.mobile.PawchiveFileProvider"
      android:authorities="\${applicationId}.pawchive.files"
      android:exported="false" android:grantUriPermissions="true">
      <meta-data android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/pawchive_file_paths" />
    </provider>
`;
if (!manifest.includes('PawchiveFileProvider')) {
  if (!manifest.includes('</application>')) throw new Error('No </application> tag in AndroidManifest.xml');
  manifest = manifest.replace('</application>', providerBlock + '</application>');
  fs.writeFileSync(manifestPath,manifest);
}
// JobScheduler UIDT service only starts for visible, user-requested transfers on Android 14+.
for (const permission of ['android.permission.RUN_USER_INITIATED_JOBS', 'android.permission.POST_NOTIFICATIONS']) {
  if (!manifest.includes(permission)) manifest = manifest.replace('<application', `<uses-permission android:name="${permission}" />\n    <application`);
}
const uidtService = `    <service android:name="com.pawchive.mobile.BackgroundTransferJobService"
      android:permission="android.permission.BIND_JOB_SERVICE"
      android:exported="false" />\n`;
if (!manifest.includes('BackgroundTransferJobService')) {
  if (!manifest.includes('</application>')) throw new Error('No </application> element for UIDT');
  manifest = manifest.replace('</application>', uidtService + '</application>');
}
fs.writeFileSync(manifestPath, manifest);
console.log('Installed M7 native plugins, UIDT service and FileProvider (idempotent).');
