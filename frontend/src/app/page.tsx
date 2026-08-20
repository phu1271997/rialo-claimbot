import Link from 'next/link';

const PIPELINE = [
  { n: '1', name: 'Extractor', desc: 'Claude Vision reads the photo: vehicle type, plate, damaged parts, severity.' },
  { n: '2', name: 'Verifier', desc: 'Cross-checks the DMV registry, EXIF metadata, and weather at the scene.' },
  { n: '3', name: 'Estimator', desc: 'Prices the repair against a Vietnamese parts table.' },
  { n: '4', name: 'Judge', desc: 'Aggregates the three, signs a verdict, and pushes it on-chain for payout.' },
];

const STACK = [
  {
    label: 'Today (Sepolia)',
    items: [
      'Chainlink Functions for external calls',
      'Chainlink Automation for the deadline',
      'Off-chain Node.js orchestrator',
      '~2000 lines, 5 services',
    ],
  },
  {
    label: 'On Rialo',
    items: [
      'Native webcall — one line',
      'Native timer inside the contract',
      'Reactive on-chain execution',
      '~500 lines, 1 service',
    ],
  },
];

export default function HomePage() {
  return (
    <div className="space-y-20">
      <section className="animate-fade-up space-y-6 py-10 text-center">
        <div className="mx-auto w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
          Ethereum Sepolia · 4-agent AI pipeline
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          Motorbike insurance that pays out in{' '}
          <span className="text-accent">90 seconds</span>, not 4 weeks
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-400">
          Take a photo, file a claim, and let four AI agents verify and decide. USDC lands in
          your wallet the moment the verdict is signed on-chain.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/policies" className="btn-primary">
            View plans
          </Link>
          <Link href="/claims/new" className="btn-ghost">
            File a claim
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold">The four-agent pipeline</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((step) => (
            <div key={step.n} className="card p-5">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-accent/15 font-bold text-accent">
                {step.n}
              </div>
              <div className="font-semibold">{step.name}</div>
              <p className="mt-1 text-sm text-slate-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-2xl font-bold">Why this exists</h2>
        <p className="mb-6 max-w-3xl text-slate-400">
          The same product on two platforms. This table is the reason Rialo targets the right
          pain point: middleware, not business logic, is where the work goes today.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {STACK.map((column) => (
            <div key={column.label} className="card p-6">
              <div className="mb-4 font-semibold">{column.label}</div>
              <ul className="space-y-2 text-sm text-slate-400">
                {column.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-accent">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-8">
        <h2 className="text-xl font-bold">Trust model</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          The backend orchestrator holds{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">ORACLE_ROLE</code>{' '}
          so it can submit verdicts — that is the weak point of the Sepolia build. Three things
          bound it: every verdict needs a valid signature, the contract caps any payout at the
          policy&apos;s remaining coverage, and Chainlink Automation refunds the claim if the
          backend dies. On Rialo this layer becomes a SCALE program and disappears entirely.
        </p>
      </section>
    </div>
  );
}
