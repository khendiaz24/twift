import { useState } from "react";
import type { SemanticColorToken } from "../../shared/types";

interface Props {
  colors: SemanticColorToken[];
}

export function ColorPalette({ colors }: Props) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  function handleCopy(token: SemanticColorToken) {
    const text = `${token.cssVar}: ${token.hex};`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedHex(token.hex);
      setTimeout(() => setCopiedHex(null), 1200);
    });
  }

  return (
    <div className="color-grid">
      {colors.map((token) => (
        <div
          key={token.cssVar}
          className="color-card"
          title={`${token.cssVar}: ${token.hex}\nClick to copy`}
          onClick={() => handleCopy(token)}
        >
          <div
            className="color-swatch"
            style={{
              background: token.hex,
              opacity: token.rgba.a < 1 ? token.rgba.a : 1,
              outline: copiedHex === token.hex ? "2px solid #6366f1" : undefined,
            }}
          />
          <div className="color-info">
            <span className="color-var">{token.cssVar.replace("--color-", "")}</span>
            <span className="color-hex">{token.hex}</span>
            <span className="color-freq">×{token.frequency}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
