import { redirect } from "next/navigation";

// Plattform-Einstellungen sind jetzt eigene Bereiche in der Sidebar (Plattform-Admins, Support).
export default function PlatformSettingsPage() {
  redirect("/platform-admins");
}
