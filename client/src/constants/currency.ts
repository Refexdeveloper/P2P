export const CURRENCY_OPTIONS = [
  { code: 'EUR', label: 'EUR (Euro)', symbol: '€' },
  { code: 'INR', label: 'INR (Indian Rupee)', symbol: '₹' },
  { code: 'USD', label: 'USD (US Dollar)', symbol: '$' },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code'];

export const DEFAULT_CURRENCY: CurrencyCode = 'INR';

export function normalizeCurrency(value?: string | null): CurrencyCode {
  const code = String(value || '')
    .trim()
    .toUpperCase();
  if (code === 'EUR' || code === 'USD' || code === 'INR') return code;
  return DEFAULT_CURRENCY;
}

export function currencySymbol(code?: string | null): string {
  const normalized = normalizeCurrency(code);
  return CURRENCY_OPTIONS.find((c) => c.code === normalized)?.symbol || '₹';
}

export function formatMoney(
  amount: number,
  currency?: string | null,
  opts?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string {
  const code = normalizeCurrency(currency);
  const maximumFractionDigits = opts?.maximumFractionDigits ?? 2;
  const minimumFractionDigits = opts?.minimumFractionDigits ?? 0;
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits,
      minimumFractionDigits,
    }).format(Number(amount) || 0);
  } catch {
    return `${currencySymbol(code)}${(Number(amount) || 0).toLocaleString('en-IN', {
      maximumFractionDigits,
      minimumFractionDigits,
    })}`;
  }
}
