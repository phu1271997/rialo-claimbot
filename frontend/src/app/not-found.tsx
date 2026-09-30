import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center py-16 text-center">
      <div className="animate-fade-up space-y-6">
        <span className="inline-block animate-float">
          <Logo size={56} />
        </span>
        <div className="num font-display text-7xl font-bold tracking-tightest text-white/15">404</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">This page took a wrong turn</h1>
          <p className="mx-auto max-w-sm text-slate-400">
            The page you were after doesn&apos;t exist. Let&apos;s get you back to something useful.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">
            Back home
          </Link>
          <Link href="/claims" className="btn-ghost">
            My claims
          </Link>
        </div>
      </div>
    </div>
  );
}
