import { z } from "zod";
import { t } from "@/i18n/de";

const email = z.string().min(1, t.auth.emailRequired).email(t.auth.emailInvalid);
// Muss zu minimum_password_length in supabase/config.toml (bzw. dem Dashboard) passen.
export const PASSWORD_MIN_LENGTH = 8;
const password = z.string().min(PASSWORD_MIN_LENGTH, t.auth.passwordTooShort);

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
    fullName: z.string().trim().max(200).optional(),
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

/** Vertragsannahme bzw. Abrechnungsdaten ergänzen (Gutschriftverfahren). */
export function contractMasterDataSchema(isFreelancer: boolean) {
  return z
    .object({
      full_name: z.string().trim().min(1, t.profile.fullNameRequired),
      street: z.string().trim(),
      house_number: z.string().trim(),
      postal_code: z.string().trim(),
      city: z.string().trim(),
      country: z.enum(["DE", "AT", "CH"]),
      iban: z
        .string()
        .trim()
        .min(1, t.creditNotes.errors.iban_missing)
        .refine((value) => isValidIbanInput(value), t.creditNotes.ibanInvalid),
      tax_number: z.string().trim(),
      vat_id: z.string().trim(),
      kleinunternehmer: z.boolean(),
      consent: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (!v.street || !v.house_number || !v.postal_code || !v.city) {
        ctx.addIssue({ code: "custom", path: ["street"], message: t.creditNotes.addressRequired });
      }
      if (isFreelancer && !v.tax_number && !v.vat_id) {
        ctx.addIssue({ code: "custom", path: ["tax_number"], message: t.creditNotes.taxRequired });
      }
      if (isFreelancer && !v.consent) {
        ctx.addIssue({ code: "custom", path: ["consent"], message: t.creditNotes.consentRequired });
      }
    });
}
export type ContractMasterDataFormInput = z.infer<ReturnType<typeof contractMasterDataSchema>>;

function isValidIbanInput(value: string): boolean {
  const iban = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of rearranged) {
    const digits = /[0-9]/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

export const billingDetailsSchema = z.object({
  iban: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidIbanInput(value), t.creditNotes.ibanInvalid),
  tax_number: z.string().trim(),
  vat_id: z.string().trim(),
});
export type BillingDetailsFormInput = z.infer<typeof billingDetailsSchema>;
