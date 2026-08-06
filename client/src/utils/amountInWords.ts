const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`.trim();
}

function threeDigits(n: number) {
  if (n < 100) return twoDigits(n);
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigits(n % 100)}` : ''}`.trim();
}

function integerToWords(num: number) {
  if (!Number.isFinite(num) || num <= 0) return '';

  let n = Math.floor(num);
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(' ');
}

/** Indian numbering system — e.g. "Forty One Thousand Three Hundred Rupees and Zero Paisa Only." */
export function numberToIndianWords(amount: number) {
  const value = Math.round((Number(amount) || 0) * 100) / 100;
  if (!Number.isFinite(value) || value === 0) return 'Zero Rupees and Zero Paisa Only.';

  const rupees = Math.floor(value);
  const paisa = Math.round((value - rupees) * 100);
  const rupeeWords = rupees > 0 ? integerToWords(rupees) : 'Zero';
  const paisaWords = paisa > 0 ? integerToWords(paisa) : 'Zero';

  return `${rupeeWords} Rupees and ${paisaWords} Paisa Only.`;
}
