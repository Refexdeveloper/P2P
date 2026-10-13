import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import {
  allFx,
  confetti,
  draftFx,
  fxToast,
  installRipple,
  overdueFx,
  pendingFx,
  rejectFx,
  returnedFx,
} from '../../utils/fx';

installRipple();

/** Colour/icon variant — maps to `.tfx-kpi.<variant>` in styles/dashboard-fx.css. */
export type KpiVariant =
  | 'all'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'overdue'
  | 'draft'
  | 'ready'
  | 'payments';

const svg = (className: string, children: ReactNode, strokeWidth = 2) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const ICONS: Record<KpiVariant, ReactNode> = {
  payments: svg(
    'tfx-ico-pay',
    <>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 10.5v7M9.5 10.5v7M14.5 10.5v7M19 10.5v7" />
      <path d="M3 20h18" />
      <circle className="coin" cx="12" cy="8" r="1.4" />
    </>
  ),
  ready: svg(
    'tfx-ico-cart',
    <>
      <path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" />
      <circle cx="9.5" cy="19.5" r="1.4" />
      <circle cx="17" cy="19.5" r="1.4" />
      <path className="tick" d="m10.5 10.5 2 2 3.5-3.6" />
    </>
  ),
  all: svg(
    'tfx-ico-doc',
    <>
      <path d="M14 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8z" />
      <path d="M14 2.5V8h5.5" />
      <path className="line" d="M8.5 13h7" />
      <path className="line l2" d="M8.5 17h5" />
    </>
  ),
  pending_approval: svg(
    'tfx-ico-clock',
    <>
      <circle cx="12" cy="12" r="9" />
      <line className="hand" x1="12" y1="12" x2="12" y2="6.5" />
      <line className="hand fast" x1="12" y1="12" x2="15.5" y2="12" />
    </>
  ),
  approved: svg(
    'tfx-ico-check',
    <>
      <path d="M12 2.8 14.4 4.6 17.3 4.5 18.2 7.3 20.6 9 19.7 11.8 20.6 14.6 18.2 16.3 17.3 19.1 14.4 19 12 20.8 9.6 19 6.7 19.1 5.8 16.3 3.4 14.6 4.3 11.8 3.4 9 5.8 7.3 6.7 4.5 9.6 4.6Z" />
      <path className="tick" d="m8.3 12 2.5 2.5 5-5.2" />
    </>,
    2.2
  ),
  rejected: svg(
    'tfx-ico-x',
    <>
      <path d="M14 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8z" />
      <path d="M14 2.5V8h5.5" />
      <path d="m9.5 12 5 5M14.5 12l-5 5" />
    </>,
    2.2
  ),
  overdue: svg(
    'tfx-ico-alarm',
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5V13l2.5 1.5M4 5l3-2.5M20 5l-3-2.5M7 20l-1.5 1.8M17 20l1.5 1.8" />
    </>
  ),
  returned: svg(
    'tfx-ico-return',
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  draft: svg(
    'tfx-ico-pen',
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
};

const BAR_HEIGHTS = [22, 34, 28, 46, 40, 62, 88];

/** Decorative rising sparkline shapes (100 × 40 viewBox), varied per card. */
const SPARKS = [
  'M0 34 C12 30,18 36,30 30 S48 26,56 28 S70 8,80 10 S92 4,100 2',
  'M0 36 C10 34,20 32,32 28 S50 30,60 24 S76 10,86 8 S96 6,100 4',
  'M0 32 C14 34,22 30,34 30 S52 34,62 24 S78 12,86 10 S96 4,100 3',
  'M0 34 C12 32,24 34,36 28 S54 30,64 22 S78 14,88 12 S96 6,100 5',
  'M0 36 C14 32,24 34,34 30 S52 24,62 26 S76 10,86 8 S96 4,100 2',
  'M0 34 C12 34,22 32,34 32 S52 30,60 26 S74 10,84 10 S94 6,100 4',
];

/** Click animation for each card — each one acts out what the status means. */
const CLICK_FX: Record<KpiVariant, (el: HTMLElement) => void> = {
  all: allFx,
  pending_approval: pendingFx,
  approved: (el) => confetti(el),
  rejected: rejectFx,
  draft: draftFx,
  returned: returnedFx,
  overdue: overdueFx,
  ready: (el) => confetti(el, 36),
  payments: (el) => confetti(el, 30),
};

/** Animates 0 → target once per target change. */
function useCountUp(target: number, duration = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!target) {
      setN(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setN(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}

export default function AnimatedKpiCard({
  title,
  value,
  variant,
  index,
  total,
  subtitle,
  live = false,
  selected = false,
  fallbackIcon,
  chart = 'bars',
  displayValue,
  percent,
  footText,
  toastText,
  interactive = true,
  onClick,
}: {
  title: string;
  value: number;
  variant: KpiVariant;
  /** Position in the row — staggers the entrance animation. */
  index: number;
  /** Denominator for the share-of-total progress bar and chip. */
  total: number;
  subtitle: string;
  /** Shows a pulsing dot before the subtitle. */
  live?: boolean;
  selected?: boolean;
  /** Remix icon class used when the variant has no custom SVG. */
  fallbackIcon?: string;
  /** Mini chart style: growing bars (default) or an animated sparkline. */
  chart?: 'bars' | 'spark';
  /** Preformatted value (e.g. "₹1.2 Cr") shown instead of the count-up number. */
  displayValue?: string;
  /** Override the share-of-total percentage. */
  percent?: number;
  /** Override the line under the number. */
  footText?: ReactNode;
  /** Toast on click; null turns it off. */
  toastText?: string | null;
  /** false = display-only card (no click effects). */
  interactive?: boolean;
  onClick?: () => void;
}) {
  const safeValue = Number(value) || 0;
  const shown = useCountUp(safeValue);
  // Once the entrance has played, drop it so click pulses don't make it replay.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    // Matches the CSS entrance: delay (index * 90ms + 100ms) + 700ms duration.
    const t = window.setTimeout(() => setEntered(true), index * 90 + 850);
    return () => window.clearTimeout(t);
  }, [index]);
  const pct =
    percent != null
      ? Math.max(0, Math.min(100, Math.round(percent)))
      : total > 0
        ? Math.min(100, Math.round((safeValue / total) * 100))
        : 0;

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!interactive || !onClick) return;
    CLICK_FX[variant](e.currentTarget);
    if (toastText !== null) {
      fxToast(toastText ?? `Showing ${title.toLowerCase()} requests`, variant === 'rejected' ? 'error' : 'info');
    }
    // Let the card's animation play before the page scrolls to the table.
    window.setTimeout(onClick, variant === 'approved' || variant === 'ready' || variant === 'payments' ? 0 : 750);
  };

  // 3D tilt + spotlight that follows the cursor (pointer devices only).
  const handleMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (!window.matchMedia('(hover: hover)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    el.classList.add('tilting');
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 8}deg) rotateY(${(x - 0.5) * 10}deg) translateY(-6px)`;
  };
  const handleLeave = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('tilting');
    e.currentTarget.style.transform = '';
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      aria-pressed={selected}
      title={`View ${title} in table`}
      className={`tfx-kpi ${variant}${selected ? ' selected' : ''}${entered ? ' tfx-entered' : ''}${interactive && onClick ? '' : ' is-static'}`}
      style={{ '--i': index } as CSSProperties}
    >
      <span className="tfx-kpi-shine" />
      <span className="tfx-kpi-spot" />
      <div className="tfx-kpi-head">
        <div className="tfx-kpi-icon">
          {ICONS[variant] ?? <i className={`${fallbackIcon} text-2xl`} aria-hidden />}
        </div>
        <div className="tfx-kpi-title">
          <h3>{title}</h3>
          <span>
            {live && <i className="tfx-live-dot" />}
            {subtitle}
          </span>
        </div>
        <span className="tfx-kpi-chip" title="Share of total">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M14 7l5 5-5 5" />
          </svg>
          {pct}%
        </span>
      </div>
      <div className="tfx-kpi-body">
        <div>
          <div className="tfx-kpi-num" title={displayValue ? title : undefined}>
            {displayValue ?? shown}
          </div>
          <div className="tfx-kpi-foot">
            {footText ?? (
              <>
                <b>{pct}%</b> of {total} total
              </>
            )}
          </div>
        </div>
        {chart === 'spark' ? (
          <svg className="tfx-kpi-spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={`spk-${variant}-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity=".32" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="area" d={`${SPARKS[index % SPARKS.length]} L100 40 L0 40 Z`} fill={`url(#spk-${variant}-${index})`} />
            <path className="line" d={SPARKS[index % SPARKS.length]} pathLength={1} />
            <circle className="dot" cx="100" cy={SPARKS[index % SPARKS.length].split(' ').pop()} r="2.4" />
          </svg>
        ) : (
          <div className="tfx-kpi-bars" aria-hidden>
            {BAR_HEIGHTS.map((h, n) => (
              <i key={n} style={{ '--h': `${h}%`, '--n': n } as CSSProperties} />
            ))}
          </div>
        )}
      </div>
      <div className="tfx-kpi-progress">
        <div className="track">
          <span className="fill" style={{ '--p': `${pct}%` } as CSSProperties} />
        </div>
        <em>{pct}%</em>
      </div>
      <span className="sr-only">Click to view {title}</span>
    </button>
  );
}
