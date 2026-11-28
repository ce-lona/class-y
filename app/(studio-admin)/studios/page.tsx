import { redirect } from "next/navigation";

// Studios sind jetzt ein Bereich der Einstellungen.
export default function StudiosPage() {
  redirect("/settings?section=studios");
}
