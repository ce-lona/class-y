import { z } from "zod";
import { t } from "@/i18n/de";

const email = z.string().min(1, t.auth.emailRequired).email(t.auth.emailInvalid);
const password = z.string().min(6, t.auth.passwordTooShort);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, t.auth.passwordRequired),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({ password });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const countryOptions = [
  { value: "DE", label: "Deutschland" },
  { value: "AT", label: "Österreich" },
  { value: "CH", label: "Schweiz" },
] as const;

// Jede Adresse im Formular besteht immer aus diesen Einzelfeldern, nie
// einem einzelnen Freitext-Feld.
export const addressFields = {
  street: z.string().optional(),
  house_number: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  country: z.enum(["DE", "AT", "CH"]),
};
export type AddressInput = z.infer<z.ZodObject<typeof addressFields>>;

export const createCompanySchema = z.object({
  name: z.string().min(1, t.companies.nameRequired),
  ...addressFields,
});
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const createStudioSchema = z.object({
  name: z.string().min(1, t.studios.nameRequired),
  ...addressFields,
});
export type CreateStudioInput = z.infer<typeof createStudioSchema>;

export const profileSchema = z.object({
  full_name: z.string().trim().min(1, t.profile.fullNameRequired),
  phone: z.string().optional(),
  ...addressFields,
  kleinunternehmer: z.boolean(),
});
export type ProfileFormInput = z.infer<typeof profileSchema>;

export const addCompanyAdminSchema = z.object({ email });
export type AddCompanyAdminInput = z.infer<typeof addCompanyAdminSchema>;

export const createTestAdminSchema = z.object({ email, password });
export type CreateTestAdminInput = z.infer<typeof createTestAdminSchema>;

export const employmentTypeOptions = [
  { value: "freelancer", label: t.contracts.employmentTypes.freelancer },
  { value: "minijob", label: t.contracts.employmentTypes.minijob },
  { value: "festangestellt", label: t.contracts.employmentTypes.festangestellt },
] as const;

export const rateModelOptions = [
  { value: "per_course", label: t.contracts.rateModels.per_course },
  { value: "hourly", label: t.contracts.rateModels.hourly },
  { value: "per_minute", label: t.contracts.rateModels.per_minute },
  { value: "fixed", label: t.contracts.rateModels.fixed },
] as const;

const COMMON_EMAIL_DOMAIN_TYPOS: Record<string, string> = {
  "gnail.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.de": "gmail.com",
  "gmail.con": "gmail.com",
  "hotnail.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "iclod.com": "icloud.com",
  "icoud.com": "icloud.com",
  "web.ed": "web.de",
  "gmxx.de": "gmx.de",
  "gxm.de": "gmx.de",
  "t-onlien.de": "t-online.de",
};

export function suggestEmailTypo(rawEmail: string): string | null {
  const trimmed = rawEmail.trim();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0) return null;
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1).toLowerCase();
  const replacement = COMMON_EMAIL_DOMAIN_TYPOS[domain];
  return replacement ? `${local}@${replacement}` : null;
}

// rateAmount bleibt im Formular ein String (Dezimalkomma erlaubt) und wird beim
// Absenden mit parseRateAmount in eine Zahl umgewandelt.
export function parseRateAmount(value: string): number {
  return Number(value.trim().replace(",", "."));
}

export const courseTypeSchema = z.object({
  name: z.string().trim().min(1, t.courseTypes.nameRequired),
  default_duration_min: z
    .string()
    .min(1, t.courseTypes.durationRequired)
    .refine((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 5 && n <= 480;
    }, t.courseTypes.durationInvalid),
});
export type CourseTypeFormInput = z.infer<typeof courseTypeSchema>;

export const offerContractSchema = z
  .object({
    email,
    employmentType: z.enum(["freelancer", "minijob", "festangestellt"]),
    rateModel: z.enum(["per_course", "hourly", "per_minute", "fixed"]),
    rateAmount: z
      .string()
      .min(1, t.contracts.rateAmountRequired)
      .refine((v) => {
        const n = parseRateAmount(v);
        return Number.isFinite(n) && n >= 0;
      }, t.contracts.rateAmountInvalid),
    validFrom: z.string().min(1, t.contracts.validFromRequired),
    validTo: z.string().optional(),
  })
  .refine((v) => !v.validTo || v.validTo >= v.validFrom, {
    message: t.contracts.validRangeInvalid,
    path: ["validTo"],
  });
export type OfferContractFormInput = z.infer<typeof offerContractSchema>;
