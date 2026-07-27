import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.beyondhoa.app',
  appName: 'Beyond HOA',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      '*.supabase.co',
      'workspaceapi-server-production-74ae.up.railway.app'
    ]
  },
  android: {
    backgroundColor: '#020617',
    allowMixedContent: true,
    webContentsDebuggingEnabled: true
  }
};

export default config;