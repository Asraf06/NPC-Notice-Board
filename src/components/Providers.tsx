'use client';

import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { ChatProvider } from '@/context/ChatContext';
import { UIProvider } from '@/context/UIContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { PwaInstallProvider } from '@/context/PwaInstallContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <UIProvider>
            <NotificationProvider>
              <PwaInstallProvider>
                {children}
              </PwaInstallProvider>
            </NotificationProvider>
          </UIProvider>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
