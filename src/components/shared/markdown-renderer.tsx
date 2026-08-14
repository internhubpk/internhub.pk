"use client";

/**
 * MarkdownRenderer
 * ----------------
 * Secure, sanitized Markdown renderer for InternHub.
 *
 * Used everywhere task/evaluation/comment content is displayed:
 *   - Task list/detail rows
 *   - Task creation/edit popup preview
 *   - Evaluation popup (task content + supervisor comments)
 *   - Submission feedback
 *
 * Security:
 *   - `rehype-sanitize` strips dangerous HTML (scripts, event handlers,
 *     javascript: URLs, etc.). The default schema is GitHub-equivalent.
 *   - `remark-gfm` adds tables, strikethrough, task lists, autolinks.
 *   - Links get `rel="noopener noreferrer"` and `target="_blank"` so
 *     external sites can't reach back into window.opener.
 *   - We never use `rehype-raw` (which would allow raw HTML) because
 *     task/comment content is user-generated and must be treated as
 *     untrusted.
 *
 * The renderer is intentionally minimal-styled to inherit the
 * surrounding text color/size; the `prose`-style classes below add
 * just enough structure (headings, lists, code blocks) to make
 * Markdown content read clearly inside Cards and dialogs.
 */

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  /** The Markdown source to render. */
  content: string | null | undefined;
  /** Optional className for the wrapping <div>. */
  className?: string;
  /** Compact mode: smaller text, tighter spacing (for inline previews). */
  compact?: boolean;
}

/**
 * Augment the default sanitize schema to allow `target` and `rel` on
 * anchor tags so we can force external links to open safely in a new
 * tab. The default schema strips these attributes.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a || []),
      "target",
      "rel",
      "title",
    ],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto", "tel"],
  },
};

/**
 * A component that rewrites every <a> to safely open in a new tab.
 * `react-markdown` v9 passes `node` as a prop — we omit it from the
 * DOM output to avoid React warnings.
 */
function SafeLink({
  href,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) {
  const { node: _node, ...domProps } = rest as any;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
      {...domProps}
    >
      {children}
    </a>
  );
}

export function MarkdownRenderer({
  content,
  className,
  compact = false,
}: MarkdownRendererProps) {
  // Memoize the rendered output so parents that re-render frequently
  // (e.g. dialogs opening/closing) don't re-parse the same content.
  const rendered = useMemo(() => {
    if (!content || !content.trim()) return null;
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={{
          a: SafeLink as any,
          h1: ({ children }) => (
            <h1 className={cn("font-semibold tracking-tight mt-4 mb-2", compact ? "text-base" : "text-xl")}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={cn("font-semibold tracking-tight mt-4 mb-2", compact ? "text-sm" : "text-lg")}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={cn("font-semibold tracking-tight mt-3 mb-1.5", compact ? "text-sm" : "text-base")}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="font-semibold mt-3 mb-1 text-sm">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="font-semibold mt-2 mb-1 text-sm">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="font-semibold mt-2 mb-1 text-xs uppercase text-muted-foreground">{children}</h6>
          ),
          p: ({ children }) => (
            <p className={cn("leading-relaxed mb-2 last:mb-0", compact ? "text-xs" : "text-sm")}>
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className={cn("list-disc pl-5 mb-2 space-y-0.5", compact ? "text-xs" : "text-sm")}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={cn("list-decimal pl-5 mb-2 space-y-0.5", compact ? "text-xs" : "text-sm")}>
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              className={cn(
                "border-l-2 border-primary/40 pl-3 italic text-muted-foreground my-2",
                compact ? "text-xs" : "text-sm"
              )}
            >
              {children}
            </blockquote>
          ),
          code: ({ inline, className: codeClassName, children }: any) => {
            if (inline) {
              return (
                <code
                  className={cn(
                    "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground",
                    codeClassName
                  )}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="overflow-x-auto rounded-md bg-muted p-3 my-2">
                <code className={cn("font-mono text-xs text-foreground", codeClassName)}>
                  {children}
                </code>
              </pre>
            );
          },
          pre: ({ children }) => <>{children}</>,
          hr: () => <hr className="my-4 border-t border-border" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-border px-3 py-1.5 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-1.5 align-top">{children}</td>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del className="line-through text-muted-foreground">{children}</del>,
        }}
      >
        {content}
      </ReactMarkdown>
    );
  }, [content, compact]);

  if (!rendered) return null;

  return (
    <div
      className={cn(
        "markdown-body text-foreground break-words",
        className
      )}
    >
      {rendered}
    </div>
  );
}

/**
 * Convenience helper: returns true if the string contains any Markdown
 * syntax that warrants rendering with MarkdownRenderer (vs. plain text).
 * Used by callers to decide whether to use MarkdownRenderer or fall back
 * to a plain <p> for performance.
 */
export function looksLikeMarkdown(s: string | null | undefined): boolean {
  if (!s) return false;
  return /(^|\n)\s*(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```|---|\*\*|__|`|\[.+?\]\(.+?\))/m.test(s);
}

export default MarkdownRenderer;
