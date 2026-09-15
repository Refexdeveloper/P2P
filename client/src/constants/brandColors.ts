/** Refex brand palette — primary / secondary / accent */
export const BRAND = {
  /** Blue — primary UI / CTAs */
  primary: '#2978B1',
  primaryRgb: '41, 120, 177',
  /** Blue — secondary surfaces / section accents (alias of primary) */
  secondary: '#2978B1',
  /** Green — accent / success highlights */
  accent: '#7CC144',
  /** Coral — reserved highlights only (avoid for primary actions) */
  coral: '#F4553B',
} as const;

/** Create PR hero banner — primary blue only */
export const BRAND_HERO_GRADIENT =
  'linear-gradient(135deg, #2978B1 0%, #1E5F8F 100%)';

/** Primary button fill */
export const BRAND_PRIMARY_GRADIENT =
  'linear-gradient(135deg, #2978B1 0%, #3A8BC4 100%)';

/** Soft primary hover overlay */
export const BRAND_PRIMARY_SOFT =
  'linear-gradient(135deg, #2978B1 0%, #5BA3D4 100%)';
