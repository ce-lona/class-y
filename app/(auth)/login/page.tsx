"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { t } from "@/i18n/de";

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await signIn(values.email, values.password);
      router.replace("/");
    } catch {
      setFormError(t.auth.loginError);
    }
  }

  return (
    <div className="grid min-h-screen flex-1 bg-background lg:grid-cols-12">
      {/* Linke Markenbühne (Desktop, flaches Petrol ohne Farbverlauf) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary-600 p-10 text-primary-foreground lg:col-span-6 lg:flex xl:p-14">
        <svg
          className="pointer-events-none absolute -right-12 -bottom-12 size-80 opacity-15"
          viewBox="0 0 200 200"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="48" cy="148" r="24" fill="#A7CDCB" />
          <circle cx="104" cy="100" r="30" fill="#79B0AD" />
          <circle cx="158" cy="48" r="36" fill="#EEF5F5" />
        </svg>

        <Link href="/" className="relative z-10 inline-flex text-2xl text-white">
          <Logo aria-hidden="true" />
          <span className="sr-only">{t.common.appName}</span>
        </Link>

        <div className="relative z-10 my-10 max-w-md space-y-5">
          <span className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-xs font-semibold tracking-wide text-white">
            {t.auth.loginEyebrow}
          </span>
          <h2 className="font-heading text-3xl leading-tight font-extrabold tracking-tight text-white xl:text-4xl">
            {t.auth.loginHeroTitle}
          </h2>
          <p className="text-sm leading-relaxed text-white/80">{t.auth.loginHeroSubtitle}</p>

          <div className="flex flex-wrap gap-2 pt-2 text-xs font-semibold text-white">
            {[t.auth.loginHeroBullet1, t.auth.loginHeroBullet2, t.auth.loginHeroBullet3].map(
              (bullet) => (
                <span
                  key={bullet}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/12 px-3 py-1.5"
                >
                  <Check className="size-3.5" />
                  <span>{bullet}</span>
                </span>
              )
            )}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/65">{t.landing.footerCopyright}</p>
      </div>

      {/* Rechte Login-Spalte */}
      <div className="flex flex-col lg:col-span-6">
        <header className="flex h-16 items-center justify-between px-5 sm:px-10 lg:justify-end">
          <Link href="/" className="text-xl lg:hidden">
            <Logo aria-hidden="true" />
            <span className="sr-only">{t.common.appName}</span>
          </Link>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-8">
            <div className="mb-6">
              <h1 className="font-heading text-2xl font-extrabold tracking-tight">
                {t.auth.loginTitle}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t.auth.loginSubtitle}</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t.auth.email}</Label>
                <Input id="email" type="email" autoComplete="email" {...register("email")} />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">{t.auth.password}</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {t.auth.forgotPassword}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              {formError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive-bg px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <Button type="submit" disabled={isSubmitting} size="lg" className="w-full gap-2">
                <span>{t.auth.login}</span>
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <Lock className="size-3.5 shrink-0" />
              <span>{t.auth.inviteOnly}</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
