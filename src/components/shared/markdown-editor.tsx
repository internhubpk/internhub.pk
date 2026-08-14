"use client";

/**
 * MarkdownEditor
 * --------------
 * A lightweight Markdown editor with a formatting toolbar and a
 * source/preview toggle.
 *
 * Design goals:
 *   - No heavy dependency (we already have react-markdown + remark-gfm
 *     + rehype-sanitize installed for the renderer).
 *   - Toolbar covers the common formatting needs: bold, italic,
 *     strikethrough, H1/H2, bullet list, numbered list, quote, inline
 *     code, code block, link, horizontal rule.
 *   - Source mode shows the raw Markdown in a textarea (so the user
 *     can type freely, paste, undo/redo via the browser).
 *   - Preview mode renders the Markdown safely via MarkdownRenderer.
 *   - Mobile-friendly: toolbar wraps, buttons are touch-target sized.
 *
 * Usage:
 *   <MarkdownEditor
 *     value={content}
 *     onChange={setContent}
 *     placeholder="Describe the task..."
 *     rows={6}
 *   />
 *
 * The editor stores raw Markdown in the parent's state — it never
 * converts to HTML before saving. This keeps the database content
 * portable, diffable, and safe (no HTML to sanitize on read).
 */

import React, { useCallback, useRef, useState } from "react";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2,
  List, ListOrdered, Quote, Code, Code2, Link as LinkIcon,
  Minus, Eye, Pencil, Undo2, Redo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./markdown-renderer";

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  /** Disable the preview toggle (e.g. for very small inputs). */
  hidePreview?: boolean;
  /** Disable the toolbar (e.g. for very small inputs). */
  hideToolbar?: boolean;
  id?: string;
  /** Optional label for screen readers */
  ariaLabel?: string;
}

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function ToolbarButton({ icon: Icon, label, onClick, disabled }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      tabIndex={-1}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write in Markdown...",
  rows = 6,
  className,
  hidePreview = false,
  hideToolbar = false,
  id,
  ariaLabel,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // History stack for undo/redo. The browser's native undo (Ctrl+Z) is
  // preserved for typed text; this stack is for toolbar actions, which
  // replace the value programmatically and bypass the native undo.
  const historyRef = useRef<string[]>([value || ""]);
  const historyIndexRef = useRef<number>(0);
  // State mirrors of the history indices so we can re-render the
  // toolbar's disabled state without reading refs during render.
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  // ----------------------------------------------------------------
  // History helpers
  // ----------------------------------------------------------------
  // Recompute the canUndo/canRedo flags from the ref pointers. Call
  // this after every mutation to historyRef / historyIndexRef.
  const syncHistoryFlags = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const pushHistory = useCallback((next: string) => {
    const stack = historyRef.current;
    const idx = historyIndexRef.current;
    // Drop any "redo" tail
    const newStack = stack.slice(0, idx + 1);
    // Avoid pushing duplicate consecutive states
    if (newStack[newStack.length - 1] === next) return;
    newStack.push(next);
    // Cap the stack at 100 entries to bound memory
    if (newStack.length > 100) newStack.shift();
    historyRef.current = newStack;
    historyIndexRef.current = newStack.length - 1;
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const undo = useCallback(() => {
    const stack = historyRef.current;
    const idx = historyIndexRef.current;
    if (idx > 0) {
      historyIndexRef.current = idx - 1;
      onChange(stack[idx - 1]);
      syncHistoryFlags();
    }
  }, [onChange, syncHistoryFlags]);

  const redo = useCallback(() => {
    const stack = historyRef.current;
    const idx = historyIndexRef.current;
    if (idx < stack.length - 1) {
      historyIndexRef.current = idx + 1;
      onChange(stack[idx + 1]);
      syncHistoryFlags();
    }
  }, [onChange, syncHistoryFlags]);

  // ----------------------------------------------------------------
  // Text manipulation helpers — operate on the textarea's current
  // selection. If there's no selection, we insert the markup with the
  // cursor positioned inside. If there's a selection, we wrap it.
  // ----------------------------------------------------------------
  const wrapSelection = useCallback(
    (before: string, after: string = before, placeholderText: string = "") => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = value.substring(start, end);
      const insertText = selected || placeholderText;
      const newValue =
        value.substring(0, start) + before + insertText + after + value.substring(end);
      onChange(newValue);
      pushHistory(newValue);
      // Restore focus and select the inserted text (or place cursor
      // inside the empty markup)
      requestAnimationFrame(() => {
        textarea.focus();
        if (selected) {
          textarea.setSelectionRange(start + before.length, start + before.length + insertText.length);
        } else {
          textarea.setSelectionRange(start + before.length, start + before.length + insertText.length);
        }
      });
    },
    [value, onChange, pushHistory]
  );

  const prefixLines = useCallback(
    (prefix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      // Expand to line boundaries
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = value.indexOf("\n", end);
      const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;
      const block = value.substring(lineStart, actualLineEnd);
      const newBlock = block
        .split("\n")
        .map((line, i) => {
          // For numbered lists, increment the prefix
          if (prefix === "1. ") {
            return `${i + 1}. ${line}`;
          }
          return prefix + line;
        })
        .join("\n");
      const newValue =
        value.substring(0, lineStart) + newBlock + value.substring(actualLineEnd);
      onChange(newValue);
      pushHistory(newValue);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(lineStart, lineStart + newBlock.length);
      });
    },
    [value, onChange, pushHistory]
  );

  const insertAtCursor = useCallback(
    (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + text + value.substring(end);
      onChange(newValue);
      pushHistory(newValue);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      });
    },
    [value, onChange, pushHistory]
  );

  const insertLink = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end) || "link text";
    const url = window.prompt("Enter URL:", "https://");
    if (!url) return;
    const text = `[${selected}](${url})`;
    const newValue = value.substring(0, start) + text + value.substring(end);
    onChange(newValue);
    pushHistory(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, start + 1 + selected.length);
    });
  }, [value, onChange, pushHistory]);

  // Handle manual typing — push to history on a debounce-ish basis
  // (every change). The native undo handles char-by-char; this stack
  // captures snapshots so toolbar undo works after typing pauses.
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      onChange(next);
      // Don't push every keystroke — only when there's a pause.
      // We approximate this by pushing when the difference is more
      // than a single character or when whitespace/punctuation is hit.
      const prev = historyRef.current[historyIndexRef.current] || "";
      const diff = Math.abs(next.length - prev.length);
      const endsWithBreak = /[.\s,;:!?]$/.test(next);
      if (diff > 5 || endsWithBreak) {
        pushHistory(next);
      }
    },
    [onChange, pushHistory]
  );

  return (
    <div className={cn("rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1", className)}>
      {/* Toolbar */}
      {!hideToolbar && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-1.5 py-1">
          <ToolbarButton icon={Bold} label="Bold (Ctrl+B)" onClick={() => wrapSelection("**", "**", "bold text")} />
          <ToolbarButton icon={Italic} label="Italic (Ctrl+I)" onClick={() => wrapSelection("*", "*", "italic text")} />
          <ToolbarButton icon={Strikethrough} label="Strikethrough" onClick={() => wrapSelection("~~", "~~", "strikethrough")} />
          <div className="w-px h-5 bg-border mx-0.5" />
          <ToolbarButton icon={Heading1} label="Heading 1" onClick={() => prefixLines("# ")} />
          <ToolbarButton icon={Heading2} label="Heading 2" onClick={() => prefixLines("## ")} />
          <div className="w-px h-5 bg-border mx-0.5" />
          <ToolbarButton icon={List} label="Bullet list" onClick={() => prefixLines("- ")} />
          <ToolbarButton icon={ListOrdered} label="Numbered list" onClick={() => prefixLines("1. ")} />
          <ToolbarButton icon={Quote} label="Blockquote" onClick={() => prefixLines("> ")} />
          <div className="w-px h-5 bg-border mx-0.5" />
          <ToolbarButton icon={Code} label="Inline code" onClick={() => wrapSelection("`", "`", "code")} />
          <ToolbarButton icon={Code2} label="Code block" onClick={() => wrapSelection("\n```\n", "\n```\n", "code block")} />
          <ToolbarButton icon={LinkIcon} label="Link" onClick={insertLink} />
          <ToolbarButton icon={Minus} label="Horizontal rule" onClick={() => insertAtCursor("\n---\n")} />
          <div className="w-px h-5 bg-border mx-0.5" />
          <ToolbarButton icon={Undo2} label="Undo" onClick={undo} disabled={!canUndo} />
          <ToolbarButton icon={Redo2} label="Redo" onClick={redo} disabled={!canRedo} />

          {/* Preview toggle (right-aligned) */}
          {!hidePreview && (
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant={mode === "edit" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setMode("edit")}
              >
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
              <Button
                type="button"
                variant={mode === "preview" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setMode("preview")}
              >
                <Eye className="h-3 w-3 mr-1" /> Preview
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Editor / Preview body */}
      {mode === "edit" || hidePreview ? (
        <Textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          rows={rows}
          aria-label={ariaLabel || placeholder}
          className="border-0 rounded-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-y font-mono text-sm leading-relaxed"
          onKeyDown={(e) => {
            // Keyboard shortcuts: Ctrl+B, Ctrl+I
            if ((e.ctrlKey || e.metaKey) && !e.altKey) {
              if (e.key === "b" || e.key === "B") {
                e.preventDefault();
                wrapSelection("**", "**", "bold text");
              } else if (e.key === "i" || e.key === "I") {
                e.preventDefault();
                wrapSelection("*", "*", "italic text");
              } else if (e.key === "k" || e.key === "K") {
                e.preventDefault();
                insertLink();
              }
            }
            // Tab inside the editor inserts 2 spaces instead of moving focus
            if (e.key === "Tab") {
              e.preventDefault();
              insertAtCursor("  ");
            }
          }}
        />
      ) : (
        <div
          className="p-3 overflow-y-auto bg-background"
          style={{ minHeight: `${(rows || 6) * 1.5}rem`, maxHeight: `${(rows || 6) * 1.5 + 4}rem` }}
        >
          {value && value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Nothing to preview. Switch to Edit mode to write content.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default MarkdownEditor;
