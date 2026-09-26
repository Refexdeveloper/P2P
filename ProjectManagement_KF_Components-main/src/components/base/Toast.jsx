/**
 * Lightweight toast stack for dashboard actions.
 * @typedef {{ id: string; message: string; type?: 'success'|'info'|'error' }} ToastMessage
 */

const tone = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  info: 'border-blue-200 bg-blue-50 text-slate-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

export default function Toast({ toasts = [], onRemove }) {
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2 p-2 sm:bottom-6 sm:right-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${tone[t.type] || tone.success}`}
          role="status"
        >
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            type="button"
            onClick={() => onRemove?.(t.id)}
            className="shrink-0 rounded-lg p-1 text-current opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <i className="ri-close-line text-base" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
