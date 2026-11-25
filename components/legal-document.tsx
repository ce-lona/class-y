import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";

/**
 * Rendert einen Rechtstext aus docs/legal/*.md. Die Markdown-Dateien sind die einzige
 * Quelle (sie werden auch anwaltlich geprüft), die Seiten zeigen sie nur an.
 * Unterstützt bewusst nur, was die Texte nutzen: Überschriften, Absätze (jede Zeile
 * ein Umbruch), Listen, Hinweis-Blöcke (">"), **fett**, `code` und [Links](url).
 */
export type LegalDocName = "impressum" | "datenschutz" | "agb";

export async function LegalDocument({ name }: { name: LegalDocName }) {
  const source = await readFile(path.join(process.cwd(), "docs", "legal", `${name}.md`), "utf8");
  return <article className="space-y-4 text-sm leading-relaxed sm:text-base">{renderBlocks(source)}</article>;
}

function renderBlocks(source: string): ReactNode[] {
  const blocks = source.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    const first = lines[0];

    const heading = /^(#{1,3})\s+(.*)$/.exec(first);
    if (heading && lines.length === 1) {
      const text = renderInline(heading[2]);
      if (heading[1].length === 1) {
        return (
          <h1 key={i} className="font-heading text-3xl font-extrabold tracking-tight">
            {text}
          </h1>
        );
      }
      if (heading[1].length === 2) {
        return (
          <h2 key={i} className="pt-4 font-heading text-xl font-bold tracking-tight">
            {text}
          </h2>
        );
      }
      return (
        <h3 key={i} className="pt-2 font-heading text-base font-bold">
          {text}
        </h3>
      );
    }

    if (lines.every((l) => l.startsWith(">"))) {
      return (
        <div key={i} className="rounded-lg border border-border bg-muted px-4 py-3 text-muted-foreground">
          {withBreaks(lines.map((l) => l.replace(/^>\s?/, "")))}
        </div>
      );
    }

    if (lines.every((l) => /^-\s+/.test(l))) {
      return (
        <ul key={i} className="list-disc space-y-1 pl-5">
          {lines.map((l, j) => (
            <li key={j}>{renderInline(l.replace(/^-\s+(\[ \]\s+)?/, ""))}</li>
          ))}
        </ul>
      );
    }

    if (lines.every((l) => /^\d+\.\s+/.test(l))) {
      return (
        <ol key={i} className="list-decimal space-y-1 pl-5">
          {lines.map((l, j) => (
            <li key={j}>{renderInline(l.replace(/^\d+\.\s+/, ""))}</li>
          ))}
        </ol>
      );
    }

    return <p key={i}>{withBreaks(lines)}</p>;
  });
}

function withBreaks(lines: string[]): ReactNode[] {
  return lines.flatMap((line, j) => (j === 0 ? [renderInline(line, j)] : [<br key={`br${j}`} />, renderInline(line, j)]));
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function renderInline(text: string, key: number | string = 0): ReactNode {
  const parts = text.split(INLINE).filter(Boolean);
  return (
    <span key={key}>
      {parts.map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={j} className="rounded bg-muted px-1 font-mono text-[0.9em]">
              {part.slice(1, -1)}
            </code>
          );
        }
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
        if (link) {
          return (
            <a key={j} href={link[2]} className="font-medium underline underline-offset-2">
              {link[1]}
            </a>
          );
        }
        return part;
      })}
    </span>
  );
}
