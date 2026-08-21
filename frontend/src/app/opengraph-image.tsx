import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ClaimBot — motorbike insurance that pays out in 90 seconds';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Rendered at request time by Satori, which supports only a subset of CSS —
 * every element needs an explicit display, and gradients go on backgroundImage.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#080b14',
          // Satori supports only the plain linear-gradient syntax — the sized,
          // positioned radial-gradient the site CSS uses fails to parse here.
          backgroundImage:
            'linear-gradient(135deg, rgba(74,222,128,0.16) 0%, rgba(8,11,20,0) 48%, rgba(56,189,248,0.10) 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '44px' }}>
          <svg width="72" height="72" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="og" x1="5" y1="3" x2="27" y2="29" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#86EFAC" />
                <stop offset="0.55" stopColor="#4ADE80" />
                <stop offset="1" stopColor="#16A34A" />
              </linearGradient>
            </defs>
            <path
              fill="url(#og)"
              fillRule="evenodd"
              d="M15.2 2.4A1.6 1.6 0 0 1 16.8 2.4L26.4 7.9A1.6 1.6 0 0 1 27.2 9.3V20.7A1.6 1.6 0 0 1 26.4 22.1L16.8 27.6A1.6 1.6 0 0 1 15.2 27.6L5.6 22.1A1.6 1.6 0 0 1 4.8 20.7V9.3A1.6 1.6 0 0 1 5.6 7.9Z M15.6 5.6A0.8 0.8 0 0 1 16.4 5.6L23.9 9.9A0.8 0.8 0 0 1 24.3 10.6V19.4A0.8 0.8 0 0 1 23.9 20.1L16.4 24.4A0.8 0.8 0 0 1 15.6 24.4L8.1 20.1A0.8 0.8 0 0 1 7.7 19.4V10.6A0.8 0.8 0 0 1 8.1 9.9Z"
            />
            <path
              fill="url(#og)"
              d="M17.6 9.0L12.4 16.3A0.5 0.5 0 0 0 12.8 17.1H15.15L14.7 21.3A0.5 0.5 0 0 0 15.6 21.6L20.0 14.5A0.5 0.5 0 0 0 19.6 13.7H17.25L18.5 9.4A0.5 0.5 0 0 0 17.6 9.0Z"
            />
          </svg>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: '#f1f5f9' }}>
            ClaimBot
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 68,
            fontWeight: 700,
            color: '#f8fafc',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            maxWidth: '900px',
          }}
        >
          Motorbike insurance that pays out in 90 seconds
        </div>

        <div style={{ display: 'flex', fontSize: 30, color: '#94a3b8', marginTop: '28px' }}>
          Four AI agents verify, estimate and judge — payout settles on-chain.
        </div>

        <div style={{ display: 'flex', gap: '14px', marginTop: '52px' }}>
          {['Ethereum Sepolia', 'Chainlink', 'Claude Vision'].map((tag) => (
            <div
              key={tag}
              style={{
                display: 'flex',
                fontSize: 22,
                color: '#4ade80',
                border: '1px solid rgba(74,222,128,0.35)',
                borderRadius: '999px',
                padding: '10px 22px',
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
