/** Quote No belongs in the PO header only — never in Terms & Conditions rows. */

export function isQuoteNoHeaderPlain(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;
  if (
    normalized === 'quote no' ||
    normalized === 'quote number' ||
    normalized === 'quotation no' ||
    normalized === 'quotation number' ||
    normalized === 'quote no c' ||
    normalized === 'rfq no' ||
    normalized === 'rfq number'
  ) {
    return true;
  }
  return /^(quote|rfq|quotation)\s+(no|number)\b/.test(normalized) && normalized.length <= 48;
}

export function stripQuoteNoTermRows(terms) {
  return (Array.isArray(terms) ? terms : []).filter(
    (row) => !isQuoteNoHeaderPlain(row?.termsHeader || row?.terms_header)
  );
}

export function blankQuoteNoPlaceholders(html) {
  return String(html || '')
    .replace(/\$aos_quotes_quote_no_c/gi, '')
    .replace(/\$aos_quotes_number/gi, '')
    .replace(/\$aos_quotes_name/gi, '')
    .replace(/\$aos_quotes_rfq_no_c/gi, '');
}

export function withoutQuoteNoTerms(terms) {
  return stripQuoteNoTermRows(terms).map((row) => ({
    ...row,
    termsDescription: blankQuoteNoPlaceholders(row?.termsDescription || row?.terms_description || ''),
  }));
}
