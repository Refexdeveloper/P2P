import { useRef, useEffect, useCallback } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  editorKey?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter description...',
  minHeight = 120,
  editorKey,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
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

  const exec = useCallback((command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    editorRef.current?.focus();
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastSyncedValue.current = html;
      onChange(html);
    }
  }, [onChange]);

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastSyncedValue.current = html;
    onChange(html);
  };

  const tools = [
    { icon: 'ri-bold', cmd: 'bold', title: 'Bold' },
    { icon: 'ri-italic', cmd: 'italic', title: 'Italic' },
    { icon: 'ri-underline', cmd: 'underline', title: 'Underline' },
    { icon: 'ri-list-unordered', cmd: 'insertUnorderedList', title: 'Bullet list' },
    { icon: 'ri-list-ordered', cmd: 'insertOrderedList', title: 'Numbered list' },
  ];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
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
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className="px-3 py-2.5 text-sm text-gray-800 focus:outline-none prose prose-sm max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
      />
    </div>
  );
}
