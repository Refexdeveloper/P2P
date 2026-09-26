import { useEffect } from 'react';
import Button from './Button';
export default function Modal({ open, onClose, title, children, footer, width = 'max-w-2xl' }) {
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
    if (!open)
        return null;
    return (<div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className={`
          relative bg-white rounded-3xl shadow-2xl w-full ${width}
          max-h-[90vh] flex flex-col
          animate-[modalIn_0.25s_ease-out]
        `} style={{ animation: 'modalIn 0.25s ease-out' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all cursor-pointer">
            <i className="ri-close-line text-lg"/>
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
        {/* Footer */}
        {footer && (<div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
            {footer}
          </div>)}
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>);
}
export function ConfirmModal({ open, onClose, onConfirm, title, description }) {
    return (<Modal open={open} onClose={onClose} title={title} width="max-w-md" footer={<>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Confirm</Button>
        </>}>
      <p className="text-gray-600 text-sm">{description}</p>
    </Modal>);
}
