import { redirect } from "next/navigation";

// Plattform-Einstellungen sind jetzt ein Reiter unter „Einstellungen“.
export default function PlatformSettingsPage() {
  redirect("/settings?tab=platform");
}
