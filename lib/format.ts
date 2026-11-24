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
