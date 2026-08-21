import { cn } from '@/lib/cn';

/**
 * ClaimBot mark: a sealed hexagonal badge with a bolt knocked out of it.
 *
 * The hex-badge silhouette is the "verified" idiom, which is what an insurance
 * verdict written on-chain is; the bolt is the 90-second payout. Both shapes are
 * knockouts on a single filled path, so the mark works on any background and
 * stays legible when it is scaled down to a favicon.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ClaimBot"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id="claimbotMark" x1="5" y1="3" x2="27" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#86EFAC" />
          <stop offset="0.55" stopColor="#4ADE80" />
          <stop offset="1" stopColor="#16A34A" />
        </linearGradient>
      </defs>

      {/* Outer badge with the inner seal ring cut out of it. */}
      <path
        fill="url(#claimbotMark)"
        fillRule="evenodd"
        d="M15.2 2.4A1.6 1.6 0 0 1 16.8 2.4L26.4 7.9A1.6 1.6 0 0 1 27.2 9.3V20.7A1.6 1.6 0 0 1 26.4 22.1L16.8 27.6A1.6 1.6 0 0 1 15.2 27.6L5.6 22.1A1.6 1.6 0 0 1 4.8 20.7V9.3A1.6 1.6 0 0 1 5.6 7.9Z
           M15.6 5.6A0.8 0.8 0 0 1 16.4 5.6L23.9 9.9A0.8 0.8 0 0 1 24.3 10.6V19.4A0.8 0.8 0 0 1 23.9 20.1L16.4 24.4A0.8 0.8 0 0 1 15.6 24.4L8.1 20.1A0.8 0.8 0 0 1 7.7 19.4V10.6A0.8 0.8 0 0 1 8.1 9.9Z"
      />

      {/* Bolt, optically centred on the badge centre at (16, 15). */}
      <path
        fill="url(#claimbotMark)"
        d="M17.6 9.0L12.4 16.3A0.5 0.5 0 0 0 12.8 17.1H15.15L14.7 21.3A0.5 0.5 0 0 0 15.6 21.6L20.0 14.5A0.5 0.5 0 0 0 19.6 13.7H17.25L18.5 9.4A0.5 0.5 0 0 0 17.6 9.0Z"
      />
    </svg>
  );
}
