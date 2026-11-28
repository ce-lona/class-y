import { redirect } from "next/navigation";

// Darstellung liegt jetzt im Avatar-Menü; übrige persönliche Einstellungen im Profil.
export default function TrainerSettingsPage() {
  redirect("/profile");
}
