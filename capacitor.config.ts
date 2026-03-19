import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.npcnoticeboard.asraf',
  appName: 'NPC Mobile',
  webDir: 'out',
  server: {
    // Start directly on /login to skip the landing page entirely
    // The AuthContext will auto-redirect to /notices if already logged in
    androidScheme: 'https',
    appStartPath: '/login',
  },
  plugins: {
    FirebaseAuthentication: {
      providers: ['google.com'],
    },
  },
};

export default config;
