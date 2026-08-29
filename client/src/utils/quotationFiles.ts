export type QuotationFileRef = {
  id?: number | null;
  fileName?: string;
  isPrimary?: boolean;
};

export type QuotationFileView = {
  fileName: string;
  extraFileId?: number | null;
  submissionId?: number | null;
};

export function allQuotationFilesForQuote(quote?: {
  quotationFileName?: string;
  quotationFiles?: QuotationFileRef[];
  submissionId?: number | null;
} | null): QuotationFileView[] {
  if (!quote) return [];
  const fromArray = Array.isArray(quote.quotationFiles) ? quote.quotationFiles : [];
  if (fromArray.length) {
    return fromArray
      .map((f, i) => ({
        fileName: String(f.fileName || '').trim(),
        extraFileId: f.id ?? null,
        submissionId: quote.submissionId ?? null,
        isPrimary: Boolean(f.isPrimary ?? i === 0),
      }))
      .filter((f) => f.fileName)
      .map(({ fileName, extraFileId, submissionId }) => ({ fileName, extraFileId, submissionId }));
  }
  const primary = String(quote.quotationFileName || '').trim();
  if (!primary) return [];
  return [{ fileName: primary, extraFileId: null, submissionId: quote.submissionId ?? null }];
}

export function allQuotationFilesForRound(round?: {
  quotationFileName?: string;
  quotationFiles?: QuotationFileRef[];
  submissionId?: number | null;
} | null): QuotationFileView[] {
  return allQuotationFilesForQuote(round);
}

export function allQuotationFilesForVendor(vendor?: {
  quotationFileName?: string;
  latestSubmissionId?: number | null;
  rounds?: Array<{
    round?: number;
    quotationFileName?: string;
    quotationFiles?: QuotationFileRef[];
    submissionId?: number | null;
  }>;
} | null): QuotationFileView[] {
  if (!vendor) return [];
  const merged: QuotationFileView[] = [];
  const seen = new Set<string>();
  for (const round of vendor.rounds || []) {
    for (const file of allQuotationFilesForRound(round)) {
      const key = `${file.submissionId || ''}:${file.extraFileId || ''}:${file.fileName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(file);
    }
  }
  if (!merged.length && vendor.quotationFileName && vendor.latestSubmissionId) {
    merged.push({
      fileName: vendor.quotationFileName,
      extraFileId: null,
      submissionId: vendor.latestSubmissionId,
    });
  }
  return merged;
}
