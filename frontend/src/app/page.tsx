import Link from 'next/link';

const PIPELINE = [
  { n: '1', name: 'Extractor', desc: 'Claude Vision đọc ảnh: loại xe, biển số, bộ phận hư, mức độ.' },
  { n: '2', name: 'Verifier', desc: 'Cross-check DMV, EXIF và thời tiết tại thời điểm chụp.' },
  { n: '3', name: 'Estimator', desc: 'Ước tính chi phí sửa theo bảng giá phụ tùng Việt Nam.' },
  { n: '4', name: 'Judge', desc: 'Tổng hợp, ký verdict và đẩy lên chain để payout.' },
];

const STACK = [
  { label: 'Hôm nay (Sepolia)', items: ['Chainlink Functions cho webcall', 'Chainlink Automation cho deadline', 'Node.js orchestrator off-chain', '~2000 dòng code, 5 service'] },
  { label: 'Trên Rialo', items: ['Native webcall — 1 dòng code', 'Native timer trong contract', 'Reactive execution on-chain', '~500 dòng code, 1 service'] },
];

export default function HomePage() {
  return (
    <div className="space-y-20">
      <section className="animate-fade-up space-y-6 py-10 text-center">
        <div className="mx-auto w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
          Ethereum Sepolia · 4-agent AI pipeline
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          Bảo hiểm xe máy bồi thường trong{' '}
          <span className="text-accent">90 giây</span>, không phải 4 tuần
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-400">
          Chụp ảnh, nộp claim, để 4 AI agent verify và quyết định. USDC về ví bạn ngay khi
          verdict được ký lên blockchain.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/policies" className="btn-primary">
            Xem gói bảo hiểm
          </Link>
          <Link href="/claims/new" className="btn-ghost">
            Nộp claim ngay
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold">Pipeline 4 agent</h2>
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
        <h2 className="mb-2 text-2xl font-bold">Vì sao dự án này tồn tại</h2>
        <p className="mb-6 max-w-3xl text-slate-400">
          Cùng một sản phẩm, hai nền tảng. Bảng dưới là lý do Rialo giải quyết đúng pain point:
          middleware chiếm phần lớn công sức, không phải business logic.
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
        <h2 className="text-xl font-bold">Mô hình tin cậy</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Backend orchestrator giữ <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">ORACLE_ROLE</code>{' '}
          để submit verdict — đây là trust point của bản Sepolia. Nó được giới hạn bằng: verdict
          phải kèm chữ ký hợp lệ, contract chặn payout vượt hạn mức policy, và Chainlink Automation
          tự hoàn phí nếu backend chết. Trên Rialo, lớp này sẽ thay bằng SCALE program — trustless
          hoàn toàn.
        </p>
      </section>
    </div>
  );
}
