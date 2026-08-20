'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { WalletConnect } from './WalletConnect';

const NAV = [
  { href: '/policies', label: 'Plans' },
  { href: '/claims/new', label: 'File a claim' },
  { href: '/claims', label: 'My claims' },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-ink-950">C</span>
          <span>ClaimBot</span>
        </Link>

        <nav className="hidden gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition',
                pathname === item.href
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto">
          <WalletConnect />
        </div>
      </div>
    </header>
  );
}
