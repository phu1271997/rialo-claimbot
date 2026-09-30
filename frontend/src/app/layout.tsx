import type { Metadata } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import { Providers } from './providers';
import { SiteHeader } from '@/components/SiteHeader';
import { Logo } from '@/components/Logo';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['500', '600', '700'],
});
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://rialo-claimbot-five.vercel.app'),
  applicationName: 'ClaimBot',
  title: {
    default: 'ClaimBot — Motorbike insurance in 90 seconds',
    template: '%s · ClaimBot',
  },
  description:
    'File a motorbike insurance claim in 90 seconds. Four AI agents verify, estimate and judge automatically. USDC payout settles on-chain on Ethereum Sepolia. Open-source testnet demo.',
  keywords: [
    'ClaimBot',
    'motorbike insurance',
    'Ethereum Sepolia',
    'testnet',
    'USDC',
    'AI claims',
    'Rialo',
  ],
  authors: [{ name: 'phu1271997', url: 'https://github.com/phu1271997/rialo-claimbot' }],
  creator: 'phu1271997',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'ClaimBot — Motorbike insurance in 90 seconds',
    description:
      'Four AI agents verify, estimate and judge a damage claim automatically. USDC settles on-chain on Ethereum Sepolia.',
    url: 'https://rialo-claimbot-five.vercel.app',
    siteName: 'ClaimBot',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClaimBot — Motorbike insurance in 90 seconds',
    description:
      'Four AI agents verify, estimate and judge a damage claim automatically. USDC settles on-chain.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrains.variable}`}
    >
      <body className="grain flex min-h-[100dvh] flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-950"
        >
          Skip to content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main" className="relative z-[2] mx-auto w-full max-w-6xl flex-1 px-5 py-10 md:py-14">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}

function SiteFooter() {
  return (
    <footer className="relative z-[2] mt-8 border-t border-white/[0.08]">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="font-display text-base font-semibold tracking-tight">ClaimBot</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
            Micro-insurance for motorbikes, settled on-chain. An MVP on Ethereum Sepolia, built to
            migrate to Rialo once mainnet is public.
          </p>
        </div>

        <nav aria-label="Product" className="text-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Product
          </div>
          <ul className="space-y-2 text-slate-400">
            <li><Link href="/dashboard" className="transition hover:text-slate-100">Dashboard</Link></li>
            <li><Link href="/policies" className="transition hover:text-slate-100">Plans</Link></li>
            <li><Link href="/claims/new" className="transition hover:text-slate-100">File a claim</Link></li>
            <li><Link href="/review" className="transition hover:text-slate-100">Review console</Link></li>
          </ul>
        </nav>

        <nav aria-label="Resources" className="text-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Resources
          </div>
          <ul className="space-y-2 text-slate-400">
            <li>
              <a
                href="https://sepolia.etherscan.io/address/0x5B67353D25817f5A58415EDA386c98eF9d7a1B08"
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-slate-100"
              >
                Contracts on Etherscan
              </a>
            </li>
            <li>
              <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="transition hover:text-slate-100">
                Test USDC faucet
              </a>
            </li>
            <li>
              <a href="https://rialo.io" target="_blank" rel="noreferrer" className="transition hover:text-slate-100">
                About Rialo
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-slate-600">
          <span>© 2026 ClaimBot · Testnet demo, not a real insurance product</span>
          <span className="chip">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Ethereum Sepolia
          </span>
        </div>
      </div>
    </footer>
  );
}
