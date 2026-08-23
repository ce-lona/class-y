"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
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

  if (submitted) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="text-xl font-semibold">{t.auth.forgotPasswordTitle}</h1>
        <p className="max-w-sm text-muted-foreground">{t.auth.forgotPasswordSuccess}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t.auth.forgotPasswordTitle}</h1>
          <p className="text-muted-foreground">{t.auth.forgotPasswordSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {t.auth.forgotPassword}
          </Button>
        </form>

        <p className="text-center text-sm">
          <Link href="/login" className="font-medium underline">
            {t.auth.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
