'use client';

import { usePathname } from 'next/navigation';
import AuthOverlay from '@/components/AuthOverlay';

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <div className="lovable-landing min-h-screen w-full bg-black text-white selection:bg-primary/30 overflow-x-hidden" suppressHydrationWarning>
      {isLoginPage && <AuthOverlay />}
      {children}
    </div>
  );
}
