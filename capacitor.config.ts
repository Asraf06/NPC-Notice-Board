import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.npcnoticeboard.admin',
  appName: 'NPC Notice Board',
  webDir: 'out',
  server: {
    // Start directly on /login to skip the landing page entirely
    // The AuthContext will auto-redirect to /notices if already logged in
    androidScheme: 'https',
    appStartPath: '/login',
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '529840057304-obbs5438idptq2qqlmor0ormdq2lf21f.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
