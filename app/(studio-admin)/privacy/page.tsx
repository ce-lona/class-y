import { redirect } from "next/navigation";

// Datenschutz (Company-Export, Offboarding) ist jetzt ein Bereich der Einstellungen.
export default function PrivacyPage() {
  redirect("/settings?section=privacy");
}
