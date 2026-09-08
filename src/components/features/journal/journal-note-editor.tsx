"use client";

import * as React from "react";
import {
  Bold,
  Italic,
  Redo2,
  Underline,
  Undo2,
} from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

export const JOURNAL_EDITOR_EMPTY_HTML = "<p><br></p>";

export type JournalEditorFont = "Sans Serif" | "Serif" | "Monospace";

export function journalEditorIsEffectivelyEmpty(html: string): boolean {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim().length === 0;
  }
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.innerText || "").trim().length === 0;
}

function runFormatCommand(editor: HTMLElement, command: string, value?: string) {
  editor.focus();
  try {
    document.execCommand(command, false, value);
  } catch {
    /* execCommand unsupported for this command */
  }
}

export function JournalNoteEditor({
  defaultHtml,
  onChange,
  font,
  onFontChange,
  placeholder = "Enter Note",
  className,
  betweenEditorAndToolbar,
}: {
  defaultHtml: string;
  onChange: (html: string) => void;
  font: JournalEditorFont;
  onFontChange: (font: JournalEditorFont) => void;
  placeholder?: string;
  className?: string;
  /** Rendered after the note body and before the formatting toolbar (e.g. tags). */
  betweenEditorAndToolbar?: React.ReactNode;
}) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange; // eslint-disable-line react-hooks/refs

  const [placeholderVisible, setPlaceholderVisible] = React.useState(true);

  const syncPlaceholder = React.useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    setPlaceholderVisible(!(el.innerText || "").trim());
  }, []);

  const emit = React.useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    onChangeRef.current(el.innerHTML);
    syncPlaceholder();
  }, [syncPlaceholder]);

  React.useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = defaultHtml?.trim() ? defaultHtml : JOURNAL_EDITOR_EMPTY_HTML;
    el.innerHTML = html;
    onChangeRef.current(html);
    setPlaceholderVisible(!(el.innerText || "").trim());
  }, [defaultHtml]);

  const exec = React.useCallback(
    (command: string, value?: string) => {
      const el = editorRef.current;
      if (!el) return;
      runFormatCommand(el, command, value);
      emit();
    },
    [emit],
  );

  const fontSurfaceClass =
    font === "Serif"
      ? "font-serif"
      : font === "Monospace"
        ? "font-mono"
        : "font-sans";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative">
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline
          aria-label={placeholder}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          className={cn(
            fontSurfaceClass,
            "min-h-40 w-full rounded-xl border border-white/20 bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-white/40",
          )}
        />
        {placeholderVisible ? (
          <span
            className="pointer-events-none absolute left-4 top-3 text-sm text-muted-foreground"
            aria-hidden
          >
            {placeholder}
          </span>
        ) : null}
      </div>

      {betweenEditorAndToolbar}

      <div className="flex items-center justify-center gap-4 rounded-xl border border-white/20 bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Undo"
            aria-label="Undo"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("undo")}
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            title="Redo"
            aria-label="Redo"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("redo")}
          >
            <Redo2 className="size-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-white/20" />

        <select
          value={font}
          title="Font"
          aria-label="Font"
          onChange={(e) => {
            onFontChange(e.target.value as JournalEditorFont);
            queueMicrotask(() => editorRef.current?.focus());
          }}
          className="bg-transparent text-sm text-muted-foreground outline-none"
        >
          <option value="Sans Serif">Sans Serif</option>
          <option value="Serif">Serif</option>
          <option value="Monospace">Monospace</option>
        </select>

        <div className="h-5 w-px bg-white/20" />

        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Bold"
            aria-label="Bold"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("bold")}
          >
            <Bold className="size-4" />
          </button>
          <button
            type="button"
            title="Italic"
            aria-label="Italic"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("italic")}
          >
            <Italic className="size-4" />
          </button>
          <button
            type="button"
            title="Underline"
            aria-label="Underline"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("underline")}
          >
            <Underline className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
