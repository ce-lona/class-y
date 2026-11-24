"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/lib/auth";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validators";
import { t } from "@/i18n/de";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    try {
      await updatePassword(values.password);
      router.replace("/");
    } catch {
      setFormError(t.common.error);
    }
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
          <div className="mb-6 space-y-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/40">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-extrabold tracking-tight">
                {t.auth.resetPasswordTitle}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.auth.resetPasswordSubtitle}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">{t.auth.newPassword}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password ? (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t.auth.passwordMinLength}</p>
              )}
            </div>

            {formError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive-bg px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
              {t.auth.resetPasswordTitle}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
