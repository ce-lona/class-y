export function getInitials(
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  const cleanedName = fullName?.trim();
  if (cleanedName) {
    const parts = cleanedName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return cleanedName.slice(0, 2).toUpperCase();
  }

  const localPart = email?.split("@")[0] ?? "";
  const tokens = localPart.split(/[._-]+/).filter(Boolean);
  if (tokens.length >= 2) {
    return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
  }
  if (localPart.length >= 2) {
    return localPart.slice(0, 2).toUpperCase();
  }
  return localPart.toUpperCase() || "??";
}

export function formatDateDE(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

export function formatTimeShort(timeValue: string): string {
  const match = /^(\d{2}:\d{2})/.exec(timeValue);
  return match ? match[1] : timeValue;
}

export function addMinutesToTime(startTime: string, minutes: number): string {
  const match = /^(\d{2}):(\d{2})/.exec(startTime);
  if (!match) return startTime;
  const startTotal = Number(match[1]) * 60 + Number(match[2]);
  const endTotal = Math.min(startTotal + Math.max(minutes, 5), 23 * 60 + 55);
  const hh = String(Math.floor(endTotal / 60)).padStart(2, "0");
  const mm = String(endTotal % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO-Wochentag 1 (Montag) bis 7 (Sonntag) ohne Zeitzonen-Shift. */
export function getIsoWeekday(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return 1;
  const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const jsDay = dt.getDay(); // 0 = Sun ... 6 = Sat
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Die sieben Tage (Mo–So) einer Woche relativ zur aktuellen Woche.
 * `weekOffset` 0 = diese Woche, 1 = nächste Woche, -1 = letzte Woche.
 */
export function getWeekDays(
  weekOffset = 0
): { weekday: number; isoDate: string; isToday: boolean }[] {
  const today = new Date();
  const todayStr = toLocalISO(today);
  const jsDay = today.getDay();
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + diffToMonday + weekOffset * 7
  );

  return Array.from({ length: 7 }, (_, idx) => {
    const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
    const isoDate = toLocalISO(dt);
    return {
      weekday: idx + 1,
      isoDate,
      isToday: isoDate === todayStr,
    };
  });
}

export function getCurrentWeekDays(): { weekday: number; isoDate: string; isToday: boolean }[] {
  return getWeekDays(0);
}

export function formatShortDayMonth(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}.${match[2]}.`;
}

// Gedämpfte Kursarten-Palette (Tokens `--course-1…6` in app/globals.css).
// Klassen ausgeschrieben, damit Tailwind sie findet.
const COURSE_ACCENTS = [
  {
    border: "border-l-course-1",
    dot: "bg-course-1",
    text: "text-course-1",
    tile: "bg-course-1/12 text-course-1 dark:bg-course-1/18",
    pill: "bg-course-1/12 text-course-1 dark:bg-course-1/18",
  },
  {
    border: "border-l-course-2",
    dot: "bg-course-2",
    text: "text-course-2",
    tile: "bg-course-2/12 text-course-2 dark:bg-course-2/18",
    pill: "bg-course-2/12 text-course-2 dark:bg-course-2/18",
  },
  {
    border: "border-l-course-3",
    dot: "bg-course-3",
    text: "text-course-3",
    tile: "bg-course-3/12 text-course-3 dark:bg-course-3/18",
    pill: "bg-course-3/12 text-course-3 dark:bg-course-3/18",
  },
  {
    border: "border-l-course-4",
    dot: "bg-course-4",
    text: "text-course-4",
    tile: "bg-course-4/12 text-course-4 dark:bg-course-4/18",
    pill: "bg-course-4/12 text-course-4 dark:bg-course-4/18",
  },
  {
    border: "border-l-course-5",
    dot: "bg-course-5",
    text: "text-course-5",
    tile: "bg-course-5/12 text-course-5 dark:bg-course-5/18",
    pill: "bg-course-5/12 text-course-5 dark:bg-course-5/18",
  },
  {
    border: "border-l-course-6",
    dot: "bg-course-6",
    text: "text-course-6",
    tile: "bg-course-6/12 text-course-6 dark:bg-course-6/18",
    pill: "bg-course-6/12 text-course-6 dark:bg-course-6/18",
  },
] as const;

export function getCourseTypeAccent(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return COURSE_ACCENTS[hash % COURSE_ACCENTS.length];
}

/** Ersetzt Platzhalter wie {name} in einem Text aus i18n/de.ts. */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
