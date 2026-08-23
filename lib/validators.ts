import { z } from "zod";
import { t } from "@/i18n/de";

const email = z.string().min(1, t.auth.emailRequired).email(t.auth.emailInvalid);
const password = z.string().min(6, t.auth.passwordTooShort);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, t.auth.passwordRequired),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email,
  password,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({ password });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const countryOptions = [
  { value: "DE", label: "Deutschland" },
  { value: "AT", label: "Österreich" },
  { value: "CH", label: "Schweiz" },
] as const;

export const createCompanySchema = z.object({
  name: z.string().min(1, t.companies.nameRequired),
  street: z.string().optional(),
  house_number: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  country: z.enum(["DE", "AT", "CH"]),
});
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
