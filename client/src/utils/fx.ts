/**
 * Lightweight DOM effects shared by the dashboard pages (ported from the RefexOne
 * dashboard mock): confetti burst, toast notifications and click ripples.
 * Styles live in styles/dashboard-fx.css.
 */

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const CONFETTI_COLORS = ['#17a2b4', '#34d9a0', '#f39a1f', '#5b8cff', '#ff7b8a', '#5fe0e6', '#ffd34d'];

/** Burst of confetti from the centre of `el`. */
export function confetti(el: Element, pieces = 60) {
  if (reducedMotion()) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < pieces; i++) {
    const c = document.createElement('i');
    c.className = 'fx-confetti';
    c.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    if (i % 3 === 0) c.style.borderRadius = '50%';
    document.body.appendChild(c);
    const a = Math.random() * Math.PI * 2;
    const v = 120 + Math.random() * 220;
    const dx = Math.cos(a) * v;
    const dy = Math.sin(a) * v - 160;
    const rot = Math.random() * 720 - 360;
    c.animate(
      [
        { transform: `translate(${cx}px,${cy}px) rotate(0)`, opacity: 1 },
        { transform: `translate(${cx + dx}px,${cy + dy}px) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${cx + dx * 1.2}px,${cy + dy + 360}px) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 1300 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.4,1)' }
    ).onfinish = () => c.remove();
  }
}

const TOAST_ICONS = {
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg>',
};

/** Small dark toast in the bottom-right that auto-dismisses. */
export function fxToast(message: string, type: 'ok' | 'info' | 'error' = 'ok') {
  let box = document.querySelector<HTMLDivElement>('.fx-toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'fx-toasts';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = `fx-toast ${type}`;
  const ic = document.createElement('span');
  ic.className = 'fx-toast-ic';
  ic.innerHTML = TOAST_ICONS[type];
  const text = document.createElement('span');
  text.textContent = message;
  t.append(ic, text);
  box.appendChild(t);
  window.setTimeout(() => {
    t.classList.add('out');
    window.setTimeout(() => t.remove(), 300);
  }, 3200);
}

let rippleInstalled = false;

/** Adds a click ripple to any `.tfx-tab`, `.dfx-tab` or `.tfx-btn` on the page (installs once). */
export function installRipple() {
  if (rippleInstalled || typeof document === 'undefined') return;
  rippleInstalled = true;
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('.tfx-tab, .dfx-tab, .tfx-btn');
    if (!el || (el as HTMLButtonElement).disabled || reducedMotion()) return;
    const r = el.getBoundingClientRect();
    const d = Math.max(r.width, r.height);
    const sp = document.createElement('span');
    sp.className = 'fx-ripple';
    sp.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    el.appendChild(sp);
    window.setTimeout(() => sp.remove(), 650);
  });
}

/**
 * "Rejected" feedback on `el`: the card shakes like a head-shake "no", a red
 * REJECTED stamp slams onto it with a drawn X, and red ✕ shards drop away.
 */
export function rejectFx(el: HTMLElement) {
  if (reducedMotion()) return;

  el.classList.remove('fx-reject-shake');
  void el.offsetWidth; // restart the animation if clicked again
  el.classList.add('fx-reject-shake');
  window.setTimeout(() => el.classList.remove('fx-reject-shake'), 700);

  const r = el.getBoundingClientRect();

  // Red flash ring around the card.
  const ring = document.createElement('div');
  ring.className = 'fx-reject-ring';
  ring.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  document.body.appendChild(ring);
  window.setTimeout(() => ring.remove(), 900);

  // Stamp with an X that draws itself.
  const stamp = document.createElement('div');
  stamp.className = 'fx-reject-stamp';
  stamp.style.left = `${r.left + r.width / 2}px`;
  stamp.style.top = `${r.top + r.height / 2}px`;
  stamp.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path class="x1" d="M7 7l10 10"/><path class="x2" d="M17 7 7 17"/></svg><span>REJECTED</span>';
  document.body.appendChild(stamp);
  window.setTimeout(() => stamp.remove(), 1500);

  // Red ✕ shards that fall with gravity (no celebratory upward burst).
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('i');
    s.className = 'fx-reject-shard';
    s.textContent = '✕';
    s.style.fontSize = `${10 + Math.random() * 10}px`;
    document.body.appendChild(s);
    const dx = (Math.random() - 0.5) * r.width * 1.1;
    const fall = 140 + Math.random() * 160;
    const rot = (Math.random() - 0.5) * 540;
    s.animate(
      [
        { transform: `translate(${cx}px,${cy}px) scale(.4) rotate(0)`, opacity: 0 },
        { transform: `translate(${cx + dx * 0.6}px,${cy - 20 - Math.random() * 30}px) scale(1) rotate(${rot / 3}deg)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${cx + dx}px,${cy + fall}px) scale(.8) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 500, delay: 180, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'backwards' }
    ).onfinish = () => s.remove();
  }
}

/** Centred overlay on top of `el` that removes itself after `ms`. */
function overlayOn(el: HTMLElement, className: string, html: string, ms: number) {
  const r = el.getBoundingClientRect();
  const o = document.createElement('div');
  o.className = `fx-ov ${className}`;
  o.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  o.innerHTML = html;
  document.body.appendChild(o);
  window.setTimeout(() => o.remove(), ms);
  return { o, r };
}

/** Restartable CSS class on the card itself (e.g. a nudge or bounce). */
function pulseClass(el: HTMLElement, cls: string, ms: number) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), ms);
}

const DOC_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 2.5V8h5.5M8.5 13h7M8.5 17h5"/></svg>';

/** Total requests: a deck of PR documents fans out of the card and settles back. */
export function allFx(el: HTMLElement) {
  if (reducedMotion()) return;
  pulseClass(el, 'fx-bounce', 700);
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'fx-doc';
    d.innerHTML = DOC_SVG;
    document.body.appendChild(d);
    const ang = (-150 + (120 / (n - 1)) * i) * (Math.PI / 180); // arc above the card
    const dist = 120 + (i % 2) * 40;
    const x = Math.cos(ang) * dist;
    const y = Math.sin(ang) * dist;
    const rot = (i - (n - 1) / 2) * 12;
    d.animate(
      [
        { transform: `translate(${cx}px,${cy}px) translate(-50%,-50%) scale(.3) rotate(0)`, opacity: 0 },
        { transform: `translate(${cx + x}px,${cy + y}px) translate(-50%,-50%) scale(1) rotate(${rot}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${cx + x * 1.05}px,${cy + y * 1.05}px) translate(-50%,-50%) scale(1) rotate(${rot}deg)`, opacity: 1, offset: 0.7 },
        { transform: `translate(${cx}px,${cy}px) translate(-50%,-50%) scale(.2) rotate(${rot * 2}deg)`, opacity: 0 },
      ],
      { duration: 1400, delay: i * 35, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' }
    ).onfinish = () => d.remove();
  }
  overlayOn(el, 'fx-all', '<div class="fx-all-glow"></div>', 1300);
}

/** Pending approval: a clock with racing hands over expanding "waiting" radar rings. */
export function pendingFx(el: HTMLElement) {
  if (reducedMotion()) return;
  pulseClass(el, 'fx-breathe', 1400);
  overlayOn(
    el,
    'fx-pending',
    `<i class="fx-ring r1"></i><i class="fx-ring r2"></i><i class="fx-ring r3"></i>
     <div class="fx-clock">
       <svg viewBox="0 0 48 48">
         <circle cx="24" cy="24" r="20" class="face"/>
         ${Array.from({ length: 12 }, (_, i) => `<line class="tick" x1="24" y1="6.5" x2="24" y2="${i % 3 === 0 ? 10 : 8.5}" transform="rotate(${i * 30} 24 24)"/>`).join('')}
         <line class="hand h" x1="24" y1="24" x2="24" y2="14"/>
         <line class="hand m" x1="24" y1="24" x2="24" y2="9"/>
         <circle cx="24" cy="24" r="2.2" class="pin"/>
       </svg>
       <span class="fx-dots"><b></b><b></b><b></b></span>
     </div>`,
    1600
  );
}

/** Draft: a sheet slides up and a pen writes three lines on it. */
export function draftFx(el: HTMLElement) {
  if (reducedMotion()) return;
  pulseClass(el, 'fx-bounce', 700);
  overlayOn(
    el,
    'fx-draft',
    `<div class="fx-sheet">
       <svg viewBox="0 0 120 80" class="fx-lines">
         <path class="l l1" d="M14 22 C30 16,44 28,60 21 S90 16,104 22"/>
         <path class="l l2" d="M14 40 C28 35,42 46,58 39 S84 35,96 40"/>
         <path class="l l3" d="M14 58 C24 54,36 62,48 57 S64 54,72 58"/>
       </svg>
       <span class="fx-pen">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
       </span>
       <i class="fx-spark s1">✦</i><i class="fx-spark s2">✦</i><i class="fx-spark s3">✦</i>
     </div>`,
    1700
  );
}

/** Returned / in progress: a U-turn arrow swooshes back with a trail. */
export function returnedFx(el: HTMLElement) {
  if (reducedMotion()) return;
  pulseClass(el, 'fx-nudge-back', 800);
  overlayOn(
    el,
    'fx-returned',
    `<svg viewBox="0 0 160 90" class="fx-uturn">
       <path class="trail" d="M140 70 H70 a28 28 0 0 1 0 -56 H40"/>
       <path class="head" d="M52 2 L36 14 L52 26"/>
     </svg>
     <i class="fx-wind w1"></i><i class="fx-wind w2"></i><i class="fx-wind w3"></i>`,
    1500
  );
}

/** Overdue: an alarm clock rings with warning waves. */
export function overdueFx(el: HTMLElement) {
  if (reducedMotion()) return;
  pulseClass(el, 'fx-reject-shake', 700);
  overlayOn(
    el,
    'fx-overdue',
    `<i class="fx-wave v1"></i><i class="fx-wave v2"></i><i class="fx-wave v3"></i>
     <div class="fx-alarm">
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5M4 5l3-2.5M20 5l-3-2.5M7 20l-1.5 1.8M17 20l1.5 1.8"/></svg>
     </div>`,
    1500
  );
}

/** Plays the same status animation the KPI cards use (e.g. from a filter tab). */
export function statusFx(status: string, el: HTMLElement) {
  switch (status) {
    case 'all':
      return allFx(el);
    case 'pending_approval':
      return pendingFx(el);
    case 'approved':
      return confetti(el);
    case 'rejected':
      return rejectFx(el);
    case 'draft':
      return draftFx(el);
    case 'returned':
      return returnedFx(el);
    case 'overdue':
      return overdueFx(el);
  }
}
