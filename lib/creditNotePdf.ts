import { A4_HEIGHT, PdfDocument } from "@/lib/pdf";
import { formatEuro, formatMonthDE } from "@/lib/billingExport";
import { fillTemplate as fill, formatDateDE, formatTimeShort, getIsoWeekday } from "@/lib/format";
import { formatIban, type BillingAddress, type BillingDocument, type BillingLine } from "@/lib/creditNotes";
import { t } from "@/i18n/de";

/**
 * PDFs für Gutschrift, Stornogutschrift und Tätigkeitsnachweis – ausschließlich aus dem
 * gespeicherten Snapshot des Belegs, damit ein ausgestellter Beleg immer gleich aussieht.
 * Bewusst förmlich: keine Anrede, keine Prüffrist, keine Hervorhebungen.
 */

const P = t.creditNotes.pdf;
const M_LEFT = 50;
const M_RIGHT = 545;
const BOTTOM = A4_HEIGHT - 70;
const MUTED = 0.4;
const RULE = 0.82;

function addressLines(a: BillingAddress): string[] {
  const street = [a.street, a.house_number].filter(Boolean).join(" ");
  const city = [a.postal_code, a.city].filter(Boolean).join(" ");
  return [street, city].filter((line) => line.length > 0);
}

function dayLabel(isoDate: string): string {
  const wd = t.plans.weekdaysShort[getIsoWeekday(isoDate) as keyof typeof t.plans.weekdaysShort];
  return `${wd} ${formatDateDE(isoDate)}`;
}

function minutesLabel(minutes: number): string {
  return fill(P.minutes, { count: minutes });
}

function hoursLabel(minutes: number): string {
  const h = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(
    minutes / 60,
  );
  return fill(P.hours, { count: h });
}

function vatPercent(rate: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(rate * 100);
}

/** Bricht einen Text in Zeilen der angegebenen Breite um. */
function wrap(pdf: PdfDocument, text: string, maxWidth: number, size: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (pdf.textWidth(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function employmentLabel(type: string | null): string {
  if (!type) return "–";
  return t.contracts.employmentTypes[type as keyof typeof t.contracts.employmentTypes] ?? type;
}

function remunerationLabel(model: string | null, amount: number | null): string {
  if (!model || amount == null) return "–";
  const m = t.contracts.rateModels[model as keyof typeof t.contracts.rateModels] ?? model;
  return `${formatEuro(Number(amount))} ${m}`;
}

export function creditNotePdfFileName(doc: BillingDocument, trainerName?: string | null): string {
  const kind =
    doc.kind === "credit_note" ? "Gutschrift" : doc.kind === "cancellation" ? "Stornogutschrift" : "Taetigkeitsnachweis";
  const id = doc.number ?? `${doc.snapshot.period_from.slice(0, 7)}-v${doc.version}`;
  const name = (trainerName ?? doc.snapshot.recipient.name ?? "")
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${kind}_${id}${name ? `_${name}` : ""}.pdf`;
}

export function buildCreditNotePdf(doc: BillingDocument): Uint8Array {
  const pdf = new PdfDocument();
  const s = doc.snapshot;
  const isStatement = doc.kind === "statement";
  const isCancellation = doc.kind === "cancellation";
  const sign = isCancellation ? -1 : 1;
  const issuer = s.issuer;
  const recipient = s.recipient;
  const issuerName = issuer.name ?? "";
  let y = 0;

  // ── Kopf: Absenderzeile, Anschrift Leistende:r, Block Company rechts ──
  const head = () => {
    const senderLine = [issuerName, ...addressLines(issuer)].join(" · ");
    pdf.text(M_LEFT, 60, senderLine, { size: 7, color: MUTED, maxWidth: 260 });
    pdf.line(M_LEFT, 64, M_LEFT + 260, 64, 0.4, RULE);
    let ay = 80;
    pdf.text(M_LEFT, ay, recipient.name ?? "", { size: 10, maxWidth: 260 });
    for (const line of addressLines(recipient)) {
      ay += 13;
      pdf.text(M_LEFT, ay, line, { size: 10, maxWidth: 260 });
    }
    let ry = 60;
    pdf.text(M_RIGHT, ry, issuerName, { size: 9, bold: true, align: "right", maxWidth: 220 });
    for (const line of addressLines(issuer)) {
      ry += 12;
      pdf.text(M_RIGHT, ry, line, { size: 9, align: "right", color: MUTED, maxWidth: 220 });
    }
  };
  head();

  // ── Titel und Kopfdaten ──
  y = 170;
  const title = isStatement
    ? `${P.statement} ${formatMonthDE(s.period_from.slice(0, 7))}`
    : `${isCancellation ? P.cancellation : P.creditNote} ${P.no} ${doc.number ?? ""}`;
  pdf.text(M_LEFT, y, title, { size: 15, bold: true });
  y += 22;

  const period = `${formatDateDE(s.period_from)} – ${formatDateDE(s.period_to)}`;
  const taxLabel = recipient.vat_id && !recipient.tax_number ? P.vatId : P.taxNumber;
  const taxValue = recipient.tax_number ?? recipient.vat_id ?? "–";
  const meta: [string, string, string, string][] = isStatement
    ? [
        [P.employer, issuerName, P.period, period],
        [P.employee, recipient.name ?? "", P.employmentType, employmentLabel(s.employment_type)],
        [P.remuneration, remunerationLabel(s.rate_model, s.rate_amount), P.createdAt, formatDateDE(doc.issue_date)],
      ]
    : [
        [P.date, formatDateDE(doc.issue_date), P.period, period],
        [P.provider, recipient.name ?? "", taxLabel, taxValue],
        [P.recipient, issuerName, P.courses, String(s.course_count)],
      ];
  if (s.studio_name) meta.push([P.studio, s.studio_name, "", ""]);
  if (isStatement && doc.version > 1) meta.push([P.version, String(doc.version), "", ""]);
  for (const [l1, v1, l2, v2] of meta) {
    pdf.text(M_LEFT, y, l1, { size: 8.5, color: MUTED });
    pdf.text(M_LEFT + 95, y, v1, { size: 8.5, maxWidth: 150 });
    if (l2) {
      pdf.text(310, y, l2, { size: 8.5, color: MUTED });
      pdf.text(400, y, v2, { size: 8.5, maxWidth: M_RIGHT - 400 });
    }
    y += 13;
  }
  y += 12;

  const paragraph = (text: string, size = 9) => {
    for (const line of wrap(pdf, text, M_RIGHT - M_LEFT, size)) {
      ensureSpace(13);
      pdf.text(M_LEFT, y, line, { size });
      y += 12.5;
    }
    y += 6;
  };

  const newPage = () => {
    pdf.addPage();
    y = 60;
  };
  const ensureSpace = (needed: number, onBreak?: () => void) => {
    if (y + needed > BOTTOM) {
      newPage();
      onBreak?.();
    }
  };

  // ── Einleitung ──
  if (isStatement) {
    paragraph(P.statementIntro);
  } else if (isCancellation) {
    paragraph(
      fill(P.cancellationIntro, {
        number: s.cancels?.number ?? "",
        date: s.cancels ? formatDateDE(s.cancels.issue_date) : "",
      }),
    );
  } else {
    if (s.replaces) {
      paragraph(
        fill(P.replacesRef, {
          number: s.replaces.number,
          date: formatDateDE(s.replaces.issue_date),
          cancellation: s.replaces.cancellation_number,
          cancellationDate: formatDateDE(s.replaces.cancellation_date),
        }),
      );
    }
    paragraph(P.intro);
  }

  // ── Tabelle ──
  const lines = [...s.lines].sort((a, b) =>
    `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`),
  );
  const fee = (line: BillingLine) => (line.fee == null ? "–" : formatEuro(sign * Number(line.fee)));
  const noteFor = (line: BillingLine) => (line.substitution ? P.substitution : "");
  const courseFor = (line: BillingLine) => line.course;

  if (isStatement) {
    const col = { date: M_LEFT + 4, start: 140, end: 180, dur: 248, studio: 258, course: 338, note: 430, pay: M_RIGHT - 4 };
    const tableHead = () => {
      pdf.line(M_LEFT, y - 11, M_RIGHT, y - 11, 0.4, RULE);
      pdf.text(col.date, y, P.colDate, { size: 7.5, bold: true });
      pdf.text(col.start, y, P.colStart, { size: 7.5, bold: true });
      pdf.text(col.end, y, P.colEnd, { size: 7.5, bold: true });
      pdf.text(col.dur, y, P.colDuration, { size: 7.5, bold: true, align: "right" });
      pdf.text(col.studio, y, P.studio, { size: 7.5, bold: true });
      pdf.text(col.course, y, P.colCourse, { size: 7.5, bold: true });
      pdf.text(col.note, y, P.colNote, { size: 7.5, bold: true });
      pdf.text(col.pay, y, P.colPay, { size: 7.5, bold: true, align: "right" });
      pdf.line(M_LEFT, y + 5, M_RIGHT, y + 5, 0.4, RULE);
      y += 18;
    };
    ensureSpace(60);
    tableHead();
    for (const line of lines) {
      ensureSpace(14, tableHead);
      pdf.text(col.date, y, dayLabel(line.date), { size: 8 });
      pdf.text(col.start, y, formatTimeShort(line.start), { size: 8 });
      pdf.text(col.end, y, formatTimeShort(line.end), { size: 8 });
      pdf.text(col.dur, y, minutesLabel(line.minutes), { size: 8, align: "right" });
      pdf.text(col.studio, y, line.studio, { size: 8, maxWidth: col.course - col.studio - 6 });
      pdf.text(col.course, y, courseFor(line), { size: 8, maxWidth: col.note - col.course - 6 });
      pdf.text(col.note, y, noteFor(line), { size: 8, maxWidth: 60 });
      pdf.text(col.pay, y, fee(line), { size: 8, align: "right" });
      y += 13;
    }
    if (s.fixed_amount != null) {
      ensureSpace(14, tableHead);
      pdf.text(col.date, y, P.fixedRow, { size: 8 });
      pdf.text(col.pay, y, formatEuro(Number(s.fixed_amount)), { size: 8, align: "right" });
      y += 13;
    }
    ensureSpace(18);
    pdf.line(M_LEFT, y - 8, M_RIGHT, y - 8, 0.4, RULE);
    pdf.text(col.date, y + 2, fill(s.course_count === 1 ? P.totalOne : P.total, { count: s.course_count }), { size: 8, bold: true });
    pdf.text(col.dur, y + 2, hoursLabel(s.minutes), { size: 8, bold: true, align: "right" });
    pdf.text(col.pay, y + 2, formatEuro(Number(doc.gross)), { size: 8, bold: true, align: "right" });
    y += 28;
    paragraph(P.statementLegal, 8);
  } else {
    const col = { date: M_LEFT + 4, time: 140, course: 215, note: 365, dur: 465, fee: M_RIGHT - 4 };
    const tableHead = () => {
      pdf.line(M_LEFT, y - 11, M_RIGHT, y - 11, 0.4, RULE);
      pdf.text(col.date, y, P.colDate, { size: 7.5, bold: true });
      pdf.text(col.time, y, P.colTime, { size: 7.5, bold: true });
      pdf.text(col.course, y, P.colCourse, { size: 7.5, bold: true });
      pdf.text(col.note, y, P.colNote, { size: 7.5, bold: true });
      pdf.text(col.dur, y, P.colDuration, { size: 7.5, bold: true, align: "right" });
      pdf.text(col.fee, y, P.colFee, { size: 7.5, bold: true, align: "right" });
      pdf.line(M_LEFT, y + 5, M_RIGHT, y + 5, 0.4, RULE);
      y += 18;
    };
    ensureSpace(60);
    tableHead();

    const studios: { name: string; lines: BillingLine[] }[] = [];
    for (const line of lines) {
      let group = studios.find((g) => g.name === line.studio);
      if (!group) {
        group = { name: line.studio, lines: [] };
        studios.push(group);
      }
      group.lines.push(line);
    }
    studios.sort((a, b) => a.name.localeCompare(b.name, "de"));

    for (const group of studios) {
      ensureSpace(30, tableHead);
      pdf.text(col.date, y, group.name, { size: 8, bold: true });
      y += 13;
      for (const line of group.lines) {
        ensureSpace(14, tableHead);
        pdf.text(col.date, y, dayLabel(line.date), { size: 8 });
        pdf.text(col.time, y, `${formatTimeShort(line.start)}–${formatTimeShort(line.end)}`, { size: 8 });
        pdf.text(col.course, y, courseFor(line), { size: 8, maxWidth: col.note - col.course - 6 });
        pdf.text(col.note, y, noteFor(line), { size: 8, maxWidth: 70 });
        pdf.text(col.dur, y, minutesLabel(line.minutes), { size: 8, align: "right" });
        pdf.text(col.fee, y, fee(line), { size: 8, align: "right" });
        y += 13;
      }
      const groupMinutes = group.lines.reduce((sum, l) => sum + l.minutes, 0);
      const groupFee = group.lines.reduce((sum, l) => sum + Number(l.fee ?? 0), 0);
      pdf.line(M_LEFT, y - 9, M_RIGHT, y - 9, 0.3, 0.9);
      pdf.text(col.date, y, fill(group.lines.length === 1 ? P.subtotalOne : P.subtotal, { studio: group.name, count: group.lines.length }), {
        size: 8,
        color: MUTED,
      });
      pdf.text(col.dur, y, minutesLabel(groupMinutes), { size: 8, color: MUTED, align: "right" });
      pdf.text(col.fee, y, formatEuro(sign * groupFee), { size: 8, color: MUTED, align: "right" });
      y += 16;
    }
    if (s.fixed_amount != null) {
      ensureSpace(14, tableHead);
      pdf.text(col.date, y, P.fixedRow, { size: 8 });
      pdf.text(col.fee, y, formatEuro(sign * Number(s.fixed_amount)), { size: 8, align: "right" });
      y += 16;
    }

    // Summen
    ensureSpace(60);
    y += 4;
    const sumLabel = 340;
    const rows: [string, number, boolean][] = recipient.kleinunternehmer
      ? [[isCancellation ? P.grossCancellation : P.grossCredit, Number(doc.gross), true]]
      : [
          [P.net, Number(doc.net), false],
          [fill(P.vat, { rate: vatPercent(Number(doc.vat_rate)) }), Number(doc.vat), false],
          [isCancellation ? P.grossCancellation : P.grossCredit, Number(doc.gross), true],
        ];
    rows.forEach(([label, amount, bold], i) => {
      if (bold && i > 0) {
        pdf.line(sumLabel, y - 9, M_RIGHT, y - 9, 0.4, RULE);
      }
      pdf.text(sumLabel, y, label, { size: 9, bold });
      pdf.text(col.fee, y, formatEuro(amount), { size: 9, bold, align: "right" });
      y += 14;
    });
    y += 12;

    if (recipient.kleinunternehmer) paragraph(P.kleinunternehmer, 8.5);

    // Zahlung
    const iban = formatIban(recipient.iban);
    const due = formatDateDE(s.payment_due);
    if (isCancellation) {
      paragraph(P.cancellationClosing);
    } else if (s.replaces) {
      const difference = Number(doc.gross) - Number(s.replaces.gross);
      paragraph(
        fill(difference >= 0 ? P.paymentReplaced : P.paymentReplacedNegative, {
          number: s.replaces.number,
          amount: formatEuro(Number(s.replaces.gross)),
          difference: formatEuro(Math.abs(difference)),
          date: due,
          iban,
        }),
      );
    } else {
      paragraph(fill(P.payment, { date: due, iban }));
    }
  }

  // ── Fußzeile auf jeder Seite ──
  const pages = pdf.pageCount;
  for (let i = 0; i < pages; i++) {
    pdf.goToPage(i);
    const footerY = A4_HEIGHT - 40;
    pdf.line(M_LEFT, footerY - 10, M_RIGHT, footerY - 10, 0.3, RULE);
    const left = isStatement
      ? `${issuerName} · ${P.statement} ${formatMonthDE(s.period_from.slice(0, 7))}`
      : s.consent_at
        ? `${issuerName} · ${fill(P.footerConsent, { date: formatDateDE(s.consent_at.slice(0, 10)) })}`
        : issuerName;
    pdf.text(M_LEFT, footerY, left, { size: 7, color: MUTED, maxWidth: 380 });
    pdf.text(M_RIGHT, footerY, fill(P.footerPage, { page: i + 1, pages }), {
      size: 7,
      color: MUTED,
      align: "right",
    });
  }

  return pdf.toBytes();
}
