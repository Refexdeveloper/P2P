/** Allowed RMC user list tags (approver dropdown). */
export const RMC_USER_TAGS = Object.freeze(['RIL_RMC', 'P2P_RMC']);

export function normalizeRmcTag(value) {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (raw === 'P2P_RMC' || raw === 'P2PRMC') return 'P2P_RMC';
  if (raw === 'RIL_RMC' || raw === 'RILRMC') return 'RIL_RMC';
  if (raw === 'P2P_RMC' || raw.includes('P2P') && raw.includes('RMC')) return 'P2P_RMC';
  if (raw.includes('RIL') && raw.includes('RMC')) return 'RIL_RMC';
  return RMC_USER_TAGS.includes(raw) ? raw : '';
}

export function parseRmcTags(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(normalizeRmcTag).filter(Boolean))];
  }
  if (value && typeof value === 'object') {
    return parseRmcTags(Object.values(value));
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parseRmcTags(parsed);
    } catch {
      /* comma / slash list */
    }
    return [
      ...new Set(
        s
          .split(/[,;/|]+/)
          .map(normalizeRmcTag)
          .filter(Boolean)
      ),
    ];
  }
  return [];
}

export function userHasRmcTag(rowOrTags) {
  const tags = Array.isArray(rowOrTags)
    ? parseRmcTags(rowOrTags)
    : parseRmcTags(rowOrTags?.rmc_tags ?? rowOrTags?.rmcTags);
  return tags.some((t) => RMC_USER_TAGS.includes(t));
}

/** SQL fragment: user belongs to RIL_RMC or P2P_RMC list (JSON or text). */
export function rmcTaggedUserSql(alias = 'u') {
  const a = alias || 'u';
  return `(
    JSON_CONTAINS(COALESCE(${a}.rmc_tags, JSON_ARRAY()), JSON_QUOTE('RIL_RMC'))
    OR JSON_CONTAINS(COALESCE(${a}.rmc_tags, JSON_ARRAY()), JSON_QUOTE('P2P_RMC'))
    OR LOWER(CAST(${a}.rmc_tags AS CHAR)) LIKE '%ril_rmc%'
    OR LOWER(CAST(${a}.rmc_tags AS CHAR)) LIKE '%p2p_rmc%'
    OR LOWER(CAST(${a}.rmc_tags AS CHAR)) LIKE '%p2p rmc%'
  )`;
}
