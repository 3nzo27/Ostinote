import { CapacitorConfig } from '@capacitor/cli';

const isDevBuild = process.env.APP_ENV === 'development';

const config: CapacitorConfig = {
  appId: isDevBuild ? 'com.ostinote.app.dev' : 'com.ostinote.app',
  appName: isDevBuild ? 'Ostinote Dev' : 'Ostinote',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#1a1918',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1918',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
