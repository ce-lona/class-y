import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/i18n/de";

export default function AuthErrorPage() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="flex h-16 items-center px-5 sm:px-10">
        <Link href="/" className="text-xl">
          <Logo aria-hidden="true" />
          <span className="sr-only">{t.common.appName}</span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-xs sm:p-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive-bg text-destructive">
            <AlertCircle className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-heading text-2xl font-extrabold tracking-tight">
              {t.auth.linkInvalidTitle}
            </h1>
            <p className="text-sm text-muted-foreground">{t.auth.linkInvalidText}</p>
          </div>
          <div className="pt-2">
            <Link href="/login" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft className="size-4" />
              <span>{t.auth.backToLogin}</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
