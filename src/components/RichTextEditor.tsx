import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import { sanitizeHref, sanitizeRichText } from '../lib/richtext';

interface RichTextEditorProps {
  /** Sanitised HTML value. */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Extra classes for the editable area. */
  className?: string;
  /**
   * Dense mode shrinks paddings/toolbar for use inside the compact If/Then
   * flow nodes. It also adds the React Flow no-drag/no-pan/no-wheel classes and
   * stops pointer/key events from bubbling to the canvas.
   */
  dense?: boolean;
  ariaLabel?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function findAnchorInSelection(
  root: HTMLElement,
  range: Range,
): HTMLAnchorElement | null {
  let node: Node | null = range.commonAncestorContainer;
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'A') {
      return node as HTMLAnchorElement;
    }
    node = node.parentNode;
  }
  if (range.startContainer.parentElement) {
    const a = range.startContainer.parentElement.closest('a');
    if (a && root.contains(a)) return a as HTMLAnchorElement;
  }
  return null;
}

/**
 * Neopply-style contentEditable editor: bordered toolbar, active format
 * highlighting (so Bold/Italic/etc. show when the caret is in that style),
 * and a proper link dialog instead of window.prompt.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  dense,
  ariaLabel,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const isInternalUpdate = useRef(false);
  const linkDialogOpen = useRef(false);
  const savedSelectionRef = useRef<Range | null>(null);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    link: false,
  });
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  useEffect(() => {
    const el = ref.current;
    // Don't sync from props while editing or while the link dialog holds a
    // saved Range — rewriting innerHTML invalidates the selection.
    if (!el || focused.current || isInternalUpdate.current || linkDialogOpen.current)
      return;
    const next = value || '';
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value]);

  useEffect(() => {
    const onSel = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || !ref.current) return;
      const range = selection.getRangeAt(0);
      if (!ref.current.contains(range.commonAncestorContainer)) return;
      updateActiveFormats();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const emit = () => {
    if (!ref.current) return;
    isInternalUpdate.current = true;
    onChange(sanitizeRichText(ref.current.innerHTML));
    queueMicrotask(() => {
      isInternalUpdate.current = false;
    });
  };

  const focus = () => ref.current?.focus();

  const updateActiveFormats = () => {
    if (!ref.current) return;
    const selection = window.getSelection();
    let isUnderline = false;
    let isInLink = false;

    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      let node: Node | null = range.commonAncestorContainer;
      while (node && node !== ref.current) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'A') {
          isInLink = true;
          break;
        }
        node = node.parentNode;
      }
      if (isInLink) {
        const contents = range.cloneContents();
        const temp = document.createElement('div');
        temp.appendChild(contents);
        isUnderline = temp.querySelector('u') !== null;
      } else {
        isUnderline = document.queryCommandState('underline');
      }
    } else {
      isUnderline = document.queryCommandState('underline');
    }

    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: isUnderline,
      link: isInLink,
    });
  };

  const exec = (cmd: string, arg?: string) => {
    focus();
    document.execCommand(cmd, false, arg);
    emit();
    setTimeout(updateActiveFormats, 0);
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && ref.current) {
      const range = selection.getRangeAt(0);
      if (ref.current.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range.cloneRange();
      }
    }
  };

  const restoreSelection = (): boolean => {
    const range = savedSelectionRef.current;
    if (!range || !ref.current) return false;
    try {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    } catch {
      // Range may be stale if the DOM was rewritten.
      return false;
    }
  };

  const closeLinkDialog = () => {
    linkDialogOpen.current = false;
    setShowLinkDialog(false);
    savedSelectionRef.current = null;
  };

  const openLinkDialog = () => {
    saveSelection();
    linkDialogOpen.current = true;

    const selection = window.getSelection();
    const range =
      selection?.rangeCount && ref.current
        ? selection.getRangeAt(0)
        : savedSelectionRef.current;
    const anchor =
      range && ref.current ? findAnchorInSelection(ref.current, range) : null;

    if (anchor) {
      setLinkUrl(anchor.getAttribute('href') ?? '');
      setLinkText(anchor.textContent ?? '');
      // Select the whole existing link so replace targets it.
      const linkRange = document.createRange();
      linkRange.selectNodeContents(anchor);
      savedSelectionRef.current = linkRange;
    } else {
      setLinkUrl('');
      setLinkText(selection?.toString() || range?.toString() || '');
    }
    setShowLinkDialog(true);
  };

  const applyLink = () => {
    const href = sanitizeHref(linkUrl);
    if (!href) return;

    focus();
    const restored = restoreSelection();
    const selection = window.getSelection();
    const selected = restored ? (selection?.toString() ?? '') : '';
    const label = (linkText.trim() || selected || href).trim();
    if (!label) return;

    const html = `<a href="${href.replace(/"/g, '&quot;')}">${escapeHtml(label)}</a>`;

    // Always insertHTML so the Text field is honored (createLink ignores it).
    // When a range is restored, insertHTML replaces the selection; otherwise
    // append at the end of the editor.
    if (restored && selection) {
      document.execCommand('insertHTML', false, html);
    } else if (ref.current) {
      ref.current.focus();
      const end = document.createRange();
      end.selectNodeContents(ref.current);
      end.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(end);
      document.execCommand('insertHTML', false, html);
    }

    emit();
    closeLinkDialog();
    setTimeout(updateActiveFormats, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Sortable cards used to register a KeyboardSensor on the wrapper; stop
    // bubbling so Space/arrows type in the question instead of starting a drag.
    e.stopPropagation();
    if (disabled) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === 'b') {
      e.preventDefault();
      exec('bold');
    } else if (key === 'i') {
      e.preventDefault();
      exec('italic');
    } else if (key === 'u') {
      e.preventDefault();
      exec('underline');
    } else if (key === 'k') {
      e.preventDefault();
      openLinkDialog();
    }
  };

  const btn = dense
    ? 'px-1.5 py-0.5 rounded text-xs'
    : 'px-3 py-1.5 rounded-md text-sm';
  const active = 'bg-blue-100 text-blue-700 border border-blue-300';
  const inactive =
    'text-slate-700 hover:bg-slate-100 border border-transparent';

  return (
    <div className={clsx('space-y-2', dense && 'nodrag nopan nowheel space-y-1')}>
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          focus();
        }}
        className={clsx(
          'flex flex-wrap items-center gap-0.5 rounded-lg border border-slate-300 bg-white shadow-sm',
          dense ? 'p-1' : 'p-1.5',
        )}
      >
        <button
          type="button"
          title="Bold (⌘B)"
          disabled={disabled}
          onClick={() => exec('bold')}
          className={clsx(
            btn,
            'font-bold transition-all disabled:opacity-50',
            activeFormats.bold ? active : inactive,
          )}
        >
          B
        </button>
        <button
          type="button"
          title="Italic (⌘I)"
          disabled={disabled}
          onClick={() => exec('italic')}
          className={clsx(
            btn,
            'italic transition-all disabled:opacity-50',
            activeFormats.italic ? active : inactive,
          )}
        >
          I
        </button>
        <button
          type="button"
          title="Underline (⌘U)"
          disabled={disabled}
          onClick={() => exec('underline')}
          className={clsx(
            btn,
            'underline transition-all disabled:opacity-50',
            activeFormats.underline ? active : inactive,
          )}
        >
          U
        </button>
        <div className={clsx('bg-slate-300', dense ? 'mx-0.5 h-3 w-px' : 'mx-1 h-5 w-px')} />
        <button
          type="button"
          title="Insert link (⌘K)"
          disabled={disabled}
          onClick={openLinkDialog}
          className={clsx(
            btn,
            'inline-flex items-center gap-1 transition-all disabled:opacity-50',
            activeFormats.link ? active : inactive,
          )}
        >
          <svg className={dense ? 'h-3 w-3' : 'h-4 w-4'} fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
              clipRule="evenodd"
            />
          </svg>
          {!dense && <span>Link</span>}
        </button>
        <button
          type="button"
          title="Remove link"
          disabled={disabled}
          onClick={() => exec('unlink')}
          className={clsx(btn, inactive, 'disabled:opacity-50')}
        >
          Unlink
        </button>
        {!dense && (
          <>
            <div className="mx-1 h-5 w-px bg-slate-300" />
            <button
              type="button"
              title="Bullet list"
              disabled={disabled}
              onClick={() => exec('insertUnorderedList')}
              className={clsx(btn, inactive, 'disabled:opacity-50')}
            >
              • List
            </button>
            <button
              type="button"
              title="Numbered list"
              disabled={disabled}
              onClick={() => exec('insertOrderedList')}
              className={clsx(btn, inactive, 'disabled:opacity-50')}
            >
              1. List
            </button>
          </>
        )}
      </div>

      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={() => {
          focused.current = true;
          updateActiveFormats();
        }}
        onBlur={() => {
          focused.current = false;
          // Blurring into the link dialog must not emit/sanitize — that
          // rewrites the DOM and kills the saved selection Range.
          if (linkDialogOpen.current) return;
          emit();
        }}
        onInput={() => {
          emit();
          updateActiveFormats();
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => {
          e.stopPropagation();
          updateActiveFormats();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        className={clsx(
          'rte-content w-full rounded-lg border border-slate-300 bg-white text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500',
          dense ? 'min-h-[2rem] px-2 py-1.5 text-sm' : 'min-h-[3rem] px-3 py-2 text-base',
          className,
        )}
      />

      {showLinkDialog && (
        <div
          className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-900/40 p-4"
          onClick={closeLinkDialog}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-slate-900">Insert link</h3>
            <label className="mt-3 block">
              <span className="label">URL</span>
              <input
                className="input"
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyLink();
                  }
                }}
                placeholder="https://"
              />
            </label>
            <label className="mt-2 block">
              <span className="label">Text (optional)</span>
              <input
                className="input"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyLink();
                  }
                }}
                placeholder="Link label"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeLinkDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!linkUrl.trim()}
                onClick={applyLink}
              >
                Add link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
