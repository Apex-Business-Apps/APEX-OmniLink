import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.apexbusiness.omnilink',
  appName: 'OmniLink',
  webDir: 'dist',
  server: {
    // For development: allow loading from local dev server
    // In production, this should be removed or set to production URL
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;

