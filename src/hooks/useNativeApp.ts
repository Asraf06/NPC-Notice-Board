import { Capacitor } from '@capacitor/core';

export function useNativeApp() {
  return Capacitor.isNativePlatform();
}
