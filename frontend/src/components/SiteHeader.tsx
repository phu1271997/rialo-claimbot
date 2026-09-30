'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';
import { WalletConnect } from './WalletConnect';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/policies', label: 'Plans' },
  { href: '/claims/new', label: 'File a claim' },
  { href: '/claims', label: 'My claims' },
  { href: '/review', label: 'Review' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-display font-semibold tracking-tight transition"
          onClick={() => setOpen(false)}
        >
          <span className="transition group-hover:rotate-[8deg]">
            <Logo size={30} />
          </span>
          <span>ClaimBot</span>
        </Link>

        <nav className="hidden gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-lg px-3 py-1.5 text-sm transition',
                  active
                    ? 'text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[15px] h-px bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <WalletConnect />
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost px-2.5 py-2 md:hidden"
          >
            <span className="relative block h-4 w-5">
              <span className={cn('absolute left-0 top-0 h-0.5 w-5 bg-current transition', open && 'translate-y-[7px] rotate-45')} />
              <span className={cn('absolute left-0 top-[7px] h-0.5 w-5 bg-current transition', open && 'opacity-0')} />
              <span className={cn('absolute left-0 top-[14px] h-0.5 w-5 bg-current transition', open && '-translate-y-[7px] -rotate-45')} />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <nav className="animate-fade-up border-t border-white/[0.08] px-5 py-3 md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-lg px-3 py-2.5 text-sm transition',
                    active ? 'bg-accent/10 text-accent' : 'text-slate-300 hover:bg-white/5',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
