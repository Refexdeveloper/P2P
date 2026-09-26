import { useEffect } from 'react';
export default function Drawer({ open, onClose, title, subtitle, children, footer, width = 'w-[720px]' }) {
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        if (open) {
            document.addEventListener('keydown', handler);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);
    return (<>
      {/* Overlay */}
      <div className={`fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={onClose}/>
      {/* Panel */}
      <div className={`
          fixed right-0 top-0 h-full ${width} max-w-[95vw] z-[100] bg-white flex flex-col
          shadow-[-8px_0_32px_rgba(0,0,0,0.08)]
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}>
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            {subtitle && <p className="text-white/70 text-xs mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition-all cursor-pointer">
            <i className="ri-close-line text-xl"/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (<div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
            {footer}
          </div>)}
      </div>
    </>);
}
