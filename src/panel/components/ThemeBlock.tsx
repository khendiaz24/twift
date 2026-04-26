import { useState } from "react";

interface Props {
  code: string;
}

export function ThemeBlock({ code }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="theme-block-wrap">
      <pre className="theme-block-code">
        <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </pre>
      <div className="copy-overlay">
        <button
          className={`copy-btn-sm ${copied ? "copied" : ""}`}
          onClick={handleCopy}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
    </div>
  );
}

/**
 * Minimal CSS syntax highlighter.
 * Handles @theme, property names, values, and inline comments.
 */
function highlight(code: string): string {
  return code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/@[a-z-]+/g, '<span class="t-at">$&</span>')
    .replace(/(--[\w-]+)(\s*:)/g, '<span class="t-prop">$1</span>$2')
    .replace(/:\s*([^;/{}\n]+)(;)/g, ': <span class="t-val">$1</span>$2')
    .replace(/(\/\*[^*]*\*\/)/g, '<span class="t-cmt">$1</span>');
}
