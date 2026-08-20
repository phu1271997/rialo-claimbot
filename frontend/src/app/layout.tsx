import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { SiteHeader } from '@/components/SiteHeader';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'ClaimBot — Bảo hiểm xe máy 90 giây',
  description:
    'Nộp claim bảo hiểm xe máy trong 90 giây. 4 AI agent verify, estimate và judge tự động. Payout USDC on-chain trên Ethereum Sepolia.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="min-h-screen">
        <Providers>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
          <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-600">
            ClaimBot · MVP trên Ethereum Sepolia · Sẽ migrate lên Rialo khi mainnet public
          </footer>
        </Providers>
      </body>
    </html>
  );
}
