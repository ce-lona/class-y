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

const COURSE_ACCENTS = [
  {
    border: "border-l-primary-600 dark:border-l-primary-400",
    dot: "bg-primary-600 dark:bg-primary-400",
    pill: "bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200",
  },
  {
    border: "border-l-link-500 dark:border-l-link-400",
    dot: "bg-link-500 dark:bg-link-400",
    pill: "bg-link-500/10 text-link-600 dark:bg-link-400/15 dark:text-link-400",
  },
  {
    border: "border-l-success",
    dot: "bg-success",
    pill: "bg-success-bg text-success",
  },
  {
    border: "border-l-warning",
    dot: "bg-warning",
    pill: "bg-warning-bg text-warning",
  },
  {
    border: "border-l-primary-400 dark:border-l-primary-300",
    dot: "bg-primary-400 dark:bg-primary-300",
    pill: "bg-primary-100/70 text-primary-800 dark:bg-primary-800/50 dark:text-primary-200",
  },
  {
    border: "border-l-neutral-500 dark:border-l-neutral-400",
    dot: "bg-neutral-500 dark:bg-neutral-400",
    pill: "bg-muted text-foreground",
  },
] as const;

export function getCourseTypeAccent(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return COURSE_ACCENTS[hash % COURSE_ACCENTS.length];
}
