import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { SiteHeader } from '@/components/SiteHeader';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'ClaimBot — Motorbike insurance in 90 seconds',
  description:
    'File a motorbike insurance claim in 90 seconds. Four AI agents verify, estimate and judge automatically. USDC payout settles on-chain on Ethereum Sepolia.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen">
        <Providers>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
          <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-600">
            ClaimBot · MVP on Ethereum Sepolia · Migrating to Rialo once mainnet is public
          </footer>
        </Providers>
      </body>
    </html>
  );
}
