import { useCallback, useEffect, useRef, useState } from 'react';
import { poApi, UserSignatureItem } from '../../../../services/api';

export type SignaturePayload = {
  signatureImage?: string;
  signatureId?: number;
  saveToGallery?: boolean;
};

interface Props {
  onChange: (payload: SignaturePayload | null) => void;
}

type Mode = 'draw' | 'upload' | 'gallery';

export default function SignatureCapture({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const inkRef = useRef(false);
  const [mode, setMode] = useState<Mode>('draw');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedGalleryId, setSelectedGalleryId] = useState<number | null>(null);
  const [saveToGallery, setSaveToGallery] = useState(true);
  const [gallery, setGallery] = useState<UserSignatureItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const emit = useCallback(
    (next: SignaturePayload | null) => {
      onChange(next);
    },
    [onChange]
  );

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    try {
      const res = await poApi.listSignatures();
      setGallery(res.data || []);
    } catch {
      setGallery([]);
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'gallery') loadGallery();
  }, [mode, loadGallery]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== 'draw') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [mode]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawing.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    inkRef.current = true;
  };

  const endDrawSafe = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !inkRef.current) return;
    const dataUrl = canvas.toDataURL('image/png');
    setPreview(dataUrl);
    setSelectedGalleryId(null);
    emit({ signatureImage: dataUrl, saveToGallery });
  };

  const clearDraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    inkRef.current = false;
    setPreview(null);
    emit(null);
  };

  const handleUpload = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      emit(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPreview(dataUrl);
      setSelectedGalleryId(null);
      emit({ signatureImage: dataUrl, saveToGallery });
    };
    reader.readAsDataURL(file);
  };

  const selectGallery = (item: UserSignatureItem) => {
    setSelectedGalleryId(item.id);
    setPreview(item.imageDataUrl);
    emit({ signatureId: item.id });
  };

  const removeGalleryItem = async (id: number) => {
    try {
      await poApi.deleteSignature(id);
      if (selectedGalleryId === id) {
        setSelectedGalleryId(null);
        setPreview(null);
        emit(null);
      }
      await loadGallery();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!preview) return;
    if (selectedGalleryId) {
      emit({ signatureId: selectedGalleryId });
    } else {
      emit({ signatureImage: preview, saveToGallery });
    }
  }, [saveToGallery, selectedGalleryId, preview, emit]);

  const modes: { key: Mode; label: string; icon: string }[] = [
    { key: 'draw', label: 'Draw', icon: 'ri-pencil-line' },
    { key: 'upload', label: 'Upload', icon: 'ri-upload-2-line' },
    { key: 'gallery', label: 'Gallery', icon: 'ri-gallery-line' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-gray-700">
          Signature <span className="text-red-500">*</span>
        </label>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMode(m.key);
                if (m.key === 'draw') {
                  setSelectedGalleryId(null);
                }
              }}
              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                mode === m.key ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <i className={m.icon}></i>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'draw' && (
        <div>
          <div className="border border-dashed border-gray-300 rounded-lg bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-36 touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={moveDraw}
              onMouseUp={endDrawSafe}
              onMouseLeave={endDrawSafe}
              onTouchStart={startDraw}
              onTouchMove={moveDraw}
              onTouchEnd={endDrawSafe}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500">Draw your signature above</p>
            <button
              type="button"
              onClick={clearDraw}
              className="text-xs text-gray-600 hover:text-red-600 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {mode === 'upload' && (
        <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50">
          <i className="ri-image-add-line text-2xl text-gray-400"></i>
          <p className="text-xs text-gray-600 mt-1 mb-3">Upload PNG or JPG signature image</p>
          <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-teal-700">
            <i className="ri-upload-2-line"></i>
            Choose File
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
          </label>
        </div>
      )}

      {mode === 'gallery' && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 min-h-[140px]">
          {galleryLoading ? (
            <p className="text-xs text-gray-500 text-center py-6">Loading gallery...</p>
          ) : gallery.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">
              No saved signatures yet. Draw or upload one and enable “Save to gallery”.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {gallery.map((item) => (
                <div
                  key={item.id}
                  className={`relative rounded-lg border bg-white p-2 cursor-pointer ${
                    selectedGalleryId === item.id ? 'border-teal-500 ring-2 ring-teal-200' : 'border-gray-200'
                  }`}
                  onClick={() => selectGallery(item)}
                >
                  <img src={item.imageDataUrl} alt={item.label} className="h-14 w-full object-contain" />
                  <p className="text-[10px] text-gray-500 mt-1 truncate">{item.label}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGalleryItem(item.id);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 text-red-500 text-xs hover:bg-red-50"
                    title="Remove"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-xs font-semibold text-emerald-800 mb-2">Signature preview (will appear on PDF)</p>
          <img src={preview} alt="Signature preview" className="h-16 object-contain bg-white rounded border border-emerald-100 px-3" />
        </div>
      )}

      {mode !== 'gallery' && (
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={saveToGallery}
            onChange={(e) => setSaveToGallery(e.target.checked)}
            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
          />
          Save this signature to my gallery for next time
        </label>
      )}
    </div>
  );
}
