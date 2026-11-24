"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, KeyRound, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/auth";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validators";
import { t } from "@/i18n/de";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    // Absichtlich kein Fehler-State: verrät sonst, ob eine E-Mail existiert.
    await resetPassword(values.email).catch(() => {});
    setSubmitted(true);
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="flex h-16 items-center justify-between px-5 sm:px-10">
        <Link href="/" className="text-xl">
          <Logo aria-hidden="true" />
          <span className="sr-only">{t.common.appName}</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-8">
          {submitted ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-bg text-success">
                <CheckCircle2 className="size-6" />
              </div>
              <div className="space-y-1.5">
                <h1 className="font-heading text-2xl font-extrabold tracking-tight">
                  {t.auth.forgotPasswordTitle}
                </h1>
                <p className="text-sm text-muted-foreground">{t.auth.forgotPasswordSuccess}</p>
              </div>
              <div className="pt-2">
                <Link href="/login" className={buttonVariants({ variant: "outline" })}>
                  <ArrowLeft className="size-4" />
                  <span>{t.auth.backToLogin}</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 space-y-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/40">
                  <KeyRound className="size-5" />
                </div>
                <div>
                  <h1 className="font-heading text-2xl font-extrabold tracking-tight">
                    {t.auth.forgotPasswordTitle}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.auth.forgotPasswordSubtitle}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t.auth.email}</Label>
                  <Input id="email" type="email" autoComplete="email" {...register("email")} />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <Button type="submit" disabled={isSubmitting} size="lg" className="w-full gap-2">
                  <Mail className="size-4" />
                  <span>{t.auth.sendResetLink}</span>
                </Button>
              </form>

              <div className="mt-6 border-t border-border pt-4 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>{t.auth.login}</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
