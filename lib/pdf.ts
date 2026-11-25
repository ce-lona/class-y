/**
 * Minimaler PDF-Writer ohne Abhängigkeiten für tabellarische Exporte.
 * Unterstützt Text (Helvetica / Helvetica-Bold, WinAnsi inkl. Umlaute und €),
 * Linien und gefüllte Rechtecke auf A4-Seiten. Koordinaten in pt, Ursprung oben links.
 */

export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

// Zeichenbreiten (1/1000 em) für ASCII 32–126 aus den Standard-AFM-Dateien.
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const HELVETICA_BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

// Unicode -> WinAnsi für Zeichen außerhalb von Latin-1.
const WIN_ANSI_EXTRA: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "„": 0x84,
  "…": 0x85,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
};

// Breiten für häufige Nicht-ASCII-Zeichen (regular, bold).
const EXTRA_WIDTHS: Record<string, [number, number]> = {
  "€": [556, 556],
  "–": [556, 556],
  "—": [1000, 1000],
  "…": [1000, 1000],
  "•": [350, 350],
  "„": [333, 500],
  "“": [333, 500],
  "”": [333, 500],
  "‚": [222, 278],
  "‘": [222, 278],
  "’": [222, 278],
  "ß": [611, 611],
  "Ä": [667, 722],
  "Ö": [778, 778],
  "Ü": [722, 722],
  "ä": [556, 556],
  "ö": [556, 611],
  "ü": [556, 611],
  "é": [556, 556],
  "è": [556, 556],
  "·": [278, 278],
};

function toWinAnsiCode(ch: string): number {
  const extra = WIN_ANSI_EXTRA[ch];
  if (extra !== undefined) return extra;
  const code = ch.codePointAt(0) ?? 63;
  if (code >= 32 && code <= 126) return code;
  if (code >= 0xa0 && code <= 0xff) return code;
  return 63; // "?"
}

function charWidth(ch: string, bold: boolean): number {
  const code = ch.codePointAt(0) ?? 63;
  if (code >= 32 && code <= 126) {
    return (bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS)[code - 32];
  }
  const extra = EXTRA_WIDTHS[ch];
  if (extra) return bold ? extra[1] : extra[0];
  return 556;
}

function encodePdfString(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = toWinAnsiCode(ch);
    if (code === 0x28 || code === 0x29 || code === 0x5c) {
      out += "\\" + String.fromCharCode(code);
    } else if (code < 32 || code > 126) {
      out += "\\" + code.toString(8).padStart(3, "0");
    } else {
      out += String.fromCharCode(code);
    }
  }
  return out;
}

function num(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export interface TextOptions {
  size?: number;
  bold?: boolean;
  align?: "left" | "right" | "center";
  /** Graustufe 0 (schwarz) bis 1 (weiß) oder RGB 0–1. */
  color?: number | [number, number, number];
  /** Maximale Breite; längerer Text wird mit "…" gekürzt. */
  maxWidth?: number;
}

function colorOp(color: number | [number, number, number], stroke: boolean): string {
  if (typeof color === "number") return `${num(color)} ${stroke ? "G" : "g"}`;
  return `${color.map(num).join(" ")} ${stroke ? "RG" : "rg"}`;
}

export class PdfDocument {
  private pages: string[][] = [];
  private pageIndex = 0;

  constructor() {
    this.addPage();
  }

  get pageCount(): number {
    return this.pages.length;
  }

  addPage(): void {
    this.pages.push([]);
    this.pageIndex = this.pages.length - 1;
  }

  /** Wechselt auf eine bestehende Seite (0-basiert), z.B. für nachträgliche Fußzeilen. */
  goToPage(index: number): void {
    if (index < 0 || index >= this.pages.length) throw new Error("page_out_of_range");
    this.pageIndex = index;
  }

  private get current(): string[] {
    return this.pages[this.pageIndex];
  }

  textWidth(text: string, size: number, bold = false): number {
    let w = 0;
    for (const ch of text) w += charWidth(ch, bold);
    return (w / 1000) * size;
  }

  truncate(text: string, maxWidth: number, size: number, bold = false): string {
    if (this.textWidth(text, size, bold) <= maxWidth) return text;
    const ellipsis = "…";
    let out = "";
    for (const ch of text) {
      if (this.textWidth(out + ch + ellipsis, size, bold) > maxWidth) break;
      out += ch;
    }
    return out + ellipsis;
  }

  text(x: number, y: number, value: string, opts: TextOptions = {}): void {
    const size = opts.size ?? 9;
    const bold = opts.bold ?? false;
    const str = opts.maxWidth ? this.truncate(value, opts.maxWidth, size, bold) : value;
    const width = this.textWidth(str, size, bold);
    let tx = x;
    if (opts.align === "right") tx = x - width;
    else if (opts.align === "center") tx = x - width / 2;
    const ty = A4_HEIGHT - y;
    const color = colorOp(opts.color ?? 0, false);
    this.current.push(
      `BT ${color} /${bold ? "F2" : "F1"} ${num(size)} Tf ${num(tx)} ${num(ty)} Td (${encodePdfString(str)}) Tj ET`
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, width = 0.5, color: number | [number, number, number] = 0.75): void {
    this.current.push(
      `${colorOp(color, true)} ${num(width)} w ${num(x1)} ${num(A4_HEIGHT - y1)} m ${num(x2)} ${num(A4_HEIGHT - y2)} l S`
    );
  }

  rect(x: number, y: number, w: number, h: number, fill: number | [number, number, number]): void {
    this.current.push(
      `${colorOp(fill, false)} ${num(x)} ${num(A4_HEIGHT - y - h)} ${num(w)} ${num(h)} re f`
    );
  }

  /** Erzeugt die PDF-Datei als Bytes (reines ASCII, daher Offsets = Zeichenanzahl). */
  toBytes(): Uint8Array {
    const objects: string[] = [];
    const pageCount = this.pages.length;
    // 1 Catalog, 2 Pages, 3 F1, 4 F2, danach je Seite: Page + Content
    const pageObjNum = (i: number) => 5 + i * 2;
    const contentObjNum = (i: number) => 6 + i * 2;

    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, i) => `${pageObjNum(i)} 0 R`).join(" ")}] /Count ${pageCount} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

    this.pages.forEach((ops, i) => {
      const stream = ops.join("\n");
      objects[pageObjNum(i)] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(A4_WIDTH)} ${num(A4_HEIGHT)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum(i)} 0 R >>`;
      objects[contentObjNum(i)] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    let out = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (let n = 1; n < objects.length; n++) {
      offsets[n] = out.length;
      out += `${n} 0 obj\n${objects[n]}\nendobj\n`;
    }
    const xrefOffset = out.length;
    out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let n = 1; n < objects.length; n++) {
      out += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
    }
    out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
