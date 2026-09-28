"use client";

import ReactMarkdown from "react-markdown";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

// Lightweight markdown renderer with copyable code blocks.
export function Markdown({ content }: { content: string }) {
  return (
    <div className="vx-prose vx-mono text-[0.85rem]">
      <ReactMarkdown
        components={{
          code(props) {
            const { children, className } = props as any;
            const isBlock = className && /language-/.test(className);
            if (isBlock) {
              return <CodeBlock code={String(children).replace(/\n$/, "")} lang={(className || "").replace("language-", "")} />;
            }
            return <code>{children}</code>;
          },
          a(props) {
            return <a href={props.href} target="_blank" rel="noopener noreferrer">{props.children}</a>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="relative group">
      <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--vx-border)] bg-[color-mix(in_oklab,var(--vx-accent)_6%,transparent)]">
        <span className="text-[10px] uppercase tracking-wider text-[var(--vx-text-muted)] vx-mono">{lang || "code"}</span>
        <button
          onClick={copy}
          className="text-[10px] flex items-center gap-1 text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] transition-colors"
          aria-label="Copy code"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="!mt-0 !rounded-t-none">
        <code>{code}</code>
      </pre>
    </div>
  );
}
