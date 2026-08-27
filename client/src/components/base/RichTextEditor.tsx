import { useRef, useEffect, useCallback } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  editorKey?: string;
  /** Extra formatting: font size, alignment, spacing, images */
  advanced?: boolean;
  allowImages?: boolean;
  /** Paste and stored value stay normal text (no bold/italic/fonts from Word/web). */
  plainTextOnly?: boolean;
}

const FONT_SIZES = [
  { label: '10', value: '1' },
  { label: '12', value: '2' },
  { label: '14', value: '3' },
  { label: '16', value: '4' },
  { label: '18', value: '5' },
  { label: '24', value: '6' },
  { label: '32', value: '7' },
];

const LINE_SPACING = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' },
];

const MAX_IMAGE_BYTES = 1_600_000;

function escapeForInsert(text: string) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r\n|\r|\n/g, '<br>');
}

function htmlToPlainText(html: string) {
  const el = document.createElement('div');
  el.innerHTML = html || '';
  return String(el.innerText || el.textContent || '').replace(/\u00a0/g, ' ');
}

function toPlainBreakHtml(html: string) {
  return escapeForInsert(htmlToPlainText(html));
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter description...',
  minHeight = 120,
  editorKey,
  advanced = false,
  allowImages = false,
  plainTextOnly = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastSyncedValue = useRef<string | null>(null);
  const mountedKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!editorRef.current) return;
    const keyChanged = mountedKey.current !== editorKey;
    if (keyChanged) {
      mountedKey.current = editorKey;
      editorRef.current.innerHTML = value || '';
      lastSyncedValue.current = value || '';
      return;
    }
    if (lastSyncedValue.current === value) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
    lastSyncedValue.current = value || '';
  }, [value, editorKey]);

  const emitHtml = useCallback(() => {
    if (!editorRef.current) return;
    let html = editorRef.current.innerHTML;
    if (plainTextOnly && /<(b|strong|i|em|u|font|span|h[1-6]|style)\b/i.test(html)) {
      const normalized = toPlainBreakHtml(html);
      editorRef.current.innerHTML = normalized;
      html = normalized;
    }
    lastSyncedValue.current = html;
    onChange(html);
  }, [onChange, plainTextOnly]);

  const exec = useCallback(
    (command: string, arg?: string) => {
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand(command, false, arg);
      editorRef.current?.focus();
      emitHtml();
    },
    [emitHtml]
  );

  const applyLineHeight = (lineHeight: string) => {
    document.execCommand('styleWithCSS', false, 'true');
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      if (editorRef.current) editorRef.current.style.lineHeight = lineHeight;
      emitHtml();
      return;
    }
    document.execCommand('formatBlock', false, 'p');
    const node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
    const block = node?.closest('p, li, div, h1, h2, h3, h4') as HTMLElement | null;
    if (block && editorRef.current?.contains(block)) {
      block.style.lineHeight = lineHeight;
      block.style.marginTop = '6px';
      block.style.marginBottom = '6px';
    }
    editorRef.current?.focus();
    emitHtml();
  };

  const insertImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_IMAGE_BYTES) {
      alert('Image is too large. Please use an image under 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      if (!src.startsWith('data:image/')) return;
      editorRef.current?.focus();
      document.execCommand('styleWithCSS', false, 'true');
      const html =
        `<figure class="annexure-figure" style="margin:12px 0;text-align:center;">` +
        `<img src="${src}" alt="${file.name.replace(/"/g, '')}" ` +
        `style="max-width:100%;height:auto;display:block;margin:0 auto;border:1px solid #d1d5db;" />` +
        `</figure><p><br></p>`;
      document.execCommand('insertHTML', false, html);
      emitHtml();
    };
    reader.readAsDataURL(file);
  };

  const handleInput = () => emitHtml();

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (allowImages && !plainTextOnly && items) {
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) insertImageFile(file);
          return;
        }
      }
    }

    e.preventDefault();
    e.stopPropagation();
    let plain = e.clipboardData?.getData('text/plain') || '';
    if (!plain.trim()) {
      plain = htmlToPlainText(e.clipboardData?.getData('text/html') || '');
    }
    if (!plain) return;
    document.execCommand('removeFormat', false);
    const ok = document.execCommand('insertHTML', false, escapeForInsert(plain));
    if (!ok && editorRef.current) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        sel.deleteFromDocument();
        sel.getRangeAt(0).insertNode(document.createTextNode(plain));
        sel.collapseToEnd();
      } else {
        editorRef.current.append(document.createTextNode(plain));
      }
    }
    emitHtml();
  };

  const tools = [
    { icon: 'ri-bold', cmd: 'bold', title: 'Bold' },
    { icon: 'ri-italic', cmd: 'italic', title: 'Italic' },
    { icon: 'ri-underline', cmd: 'underline', title: 'Underline' },
    { icon: 'ri-list-unordered', cmd: 'insertUnorderedList', title: 'Bullet list' },
    { icon: 'ri-list-ordered', cmd: 'insertOrderedList', title: 'Numbered list' },
  ];

  const alignTools = [
    { icon: 'ri-align-left', cmd: 'justifyLeft', title: 'Align left' },
    { icon: 'ri-align-center', cmd: 'justifyCenter', title: 'Align center' },
    { icon: 'ri-align-right', cmd: 'justifyRight', title: 'Align right' },
    { icon: 'ri-align-justify', cmd: 'justifyFull', title: 'Justify' },
  ];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {!plainTextOnly && (
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
        {tools.map((tool) => (
          <button
            key={tool.cmd}
            type="button"
            title={tool.title}
            onMouseDown={(e) => {
              e.preventDefault();
              exec(tool.cmd);
            }}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
          >
            <i className={tool.icon}></i>
          </button>
        ))}
        {advanced && (
          <>
            <span className="w-px h-5 bg-gray-200 mx-1" />
            {alignTools.map((tool) => (
              <button
                key={tool.cmd}
                type="button"
                title={tool.title}
                onMouseDown={(e) => {
                  e.preventDefault();
                  exec(tool.cmd);
                }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
              >
                <i className={tool.icon}></i>
              </button>
            ))}
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <label className="flex items-center gap-1 text-[11px] text-gray-500 px-1">
              Size
              <select
                title="Font size"
                defaultValue="3"
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  exec('fontSize', e.target.value);
                }}
                className="h-7 border border-gray-200 rounded px-1 text-xs bg-white cursor-pointer"
              >
                {FONT_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-[11px] text-gray-500 px-1">
              Spacing
              <select
                title="Line spacing"
                defaultValue="1.5"
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => applyLineHeight(e.target.value)}
                className="h-7 border border-gray-200 rounded px-1 text-xs bg-white cursor-pointer"
              >
                {LINE_SPACING.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {allowImages && (
          <>
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <button
              type="button"
              title="Insert image"
              onMouseDown={(e) => {
                e.preventDefault();
                fileRef.current?.click();
              }}
              className="h-8 px-2 inline-flex items-center gap-1 rounded hover:bg-gray-200 text-gray-600 cursor-pointer text-xs font-medium"
            >
              <i className="ri-image-add-line text-sm"></i>
              Image
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) insertImageFile(file);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={emitHtml}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        style={{ minHeight, lineHeight: advanced ? 1.5 : undefined }}
        className="px-3 py-2.5 text-sm text-gray-800 font-sans font-normal focus:outline-none prose prose-sm max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 [&_img]:max-w-full [&_img]:h-auto [&_figure]:my-3 [&_*]:font-sans [&_*]:text-inherit"
      />
    </div>
  );
}
