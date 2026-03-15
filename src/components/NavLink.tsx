'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { forwardRef, AnchorHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface NavLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    const pathname = usePathname();
    const isActive = pathname === to;

    return (
      <Link
        href={to}
        ref={ref}
        className={cn(className, isActive && activeClassName)}
        {...props as any}
      />
    );
  }
);

NavLink.displayName = "NavLink";

export { NavLink };
