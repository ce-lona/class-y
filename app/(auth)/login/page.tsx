"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, Lock, LogIn } from "lucide-react";
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
              <LogIn className="size-5" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-extrabold tracking-tight">
                {t.auth.loginTitle}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t.auth.loginSubtitle}</p>
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
  );
}
