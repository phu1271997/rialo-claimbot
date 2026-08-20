import { formatUnits } from 'viem';

export const USDC_DECIMALS = 6;
export const USD_VND_RATE = 25_000;

export function formatUsdc(amount: bigint | undefined): string {
  if (amount === undefined) return '—';
  return `${Number(formatUnits(amount, USDC_DECIMALS)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`;
}

export function usdcToVnd(amount: bigint | undefined): string {
  if (amount === undefined) return '—';
  const usd = Number(formatUnits(amount, USDC_DECIMALS));
  return `${Math.round(usd * USD_VND_RATE).toLocaleString('en-US')} ₫`;
}

export function shortAddress(address?: string): string {
  if (!address) return '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatDeadline(deadline: bigint | undefined): string {
  if (!deadline) return '—';
  const ms = Number(deadline) * 1000;
  const remaining = ms - Date.now();
  if (remaining <= 0) return 'Deadline passed';
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}
