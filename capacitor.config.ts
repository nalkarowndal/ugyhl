import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.pawchive.mobile',
  appName: 'Pawchive Mobile',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: { allowMixedContent: false }
};
export default config;
