import { createClient } from "@/lib/supabase/client";
import { toLocalISO } from "@/lib/format";

export type MonitoringStatus = "completed" | "overdue" | "planned" | "cancelled";
export type MonitoringPeriod = "this_week" | "last_week" | "this_month" | "last_month";

export interface MonitoringRow {
  row_key: string;
  session_id: string | null;
  course_plan_slot_id: string | null;
  studio_id: string;
  studio_name: string;
  course_date: string;
  start_time: string;
  end_time: string;
  course_type_id: string | null;
  course_type_name: string;
  trainer_id: string;
  trainer_name: string | null;
  trainer_email: string;
  scheduled_trainer_name: string | null;
  is_substitution: boolean;
  is_ad_hoc: boolean;
  status: MonitoringStatus;
  notes: string | null;
  employment_type: string | null;
  rate_model: string | null;
  rate_amount: number | null;
}

export interface TrainerMonitoringSummary {
  trainer_id: string;
  trainer_name: string | null;
  trainer_email: string;
  employment_type: string | null;
  rate_model: string | null;
  rate_amount: number | null;
  completedCount: number;
  overdueCount: number;
  plannedCount: number;
  cancelledCount: number;
  substitutionCount: number;
  adHocCount: number;
  completedMinutes: number;
  estimatedAmount: number | null;
  isFixedRate: boolean;
}

export function getPeriodRange(period: MonitoringPeriod): { from: string; to: string } {
  const now = new Date();
  const jsDay = now.getDay();
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;

  if (period === "this_week" || period === "last_week") {
    const offsetDays = period === "last_week" ? -7 : 0;
    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + diffToMonday + offsetDays
    );
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { from: toLocalISO(monday), to: toLocalISO(sunday) };
  }

  if (period === "this_month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toLocalISO(first), to: toLocalISO(last) };
  }

  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toLocalISO(first), to: toLocalISO(last) };
}

function durationMinutes(startTime: string, endTime: string): number {
  const s = /^(\d{2}):(\d{2})/.exec(startTime);
  const e = /^(\d{2}):(\d{2})/.exec(endTime);
  if (!s || !e) return 0;
  const diff = Number(e[1]) * 60 + Number(e[2]) - (Number(s[1]) * 60 + Number(s[2]));
  return Math.max(0, diff);
}

export function summarizeByTrainer(rows: MonitoringRow[]): TrainerMonitoringSummary[] {
  const map = new Map<string, TrainerMonitoringSummary>();

  for (const row of rows) {
    let entry = map.get(row.trainer_id);
    if (!entry) {
      entry = {
        trainer_id: row.trainer_id,
        trainer_name: row.trainer_name,
        trainer_email: row.trainer_email,
        employment_type: row.employment_type,
        rate_model: row.rate_model,
        rate_amount: row.rate_amount != null ? Number(row.rate_amount) : null,
        completedCount: 0,
        overdueCount: 0,
        plannedCount: 0,
        cancelledCount: 0,
        substitutionCount: 0,
        adHocCount: 0,
        completedMinutes: 0,
        estimatedAmount: null,
        isFixedRate: row.rate_model === "fixed",
      };
      map.set(row.trainer_id, entry);
    }

    if (row.status === "completed") {
      entry.completedCount += 1;
      entry.completedMinutes += durationMinutes(row.start_time, row.end_time);
    } else if (row.status === "overdue") {
      entry.overdueCount += 1;
    } else if (row.status === "planned") {
      entry.plannedCount += 1;
    } else if (row.status === "cancelled") {
      entry.cancelledCount += 1;
    }

    if (row.is_substitution) entry.substitutionCount += 1;
    if (row.is_ad_hoc) entry.adHocCount += 1;

    if (entry.rate_amount == null && row.rate_amount != null) {
      entry.rate_amount = Number(row.rate_amount);
      entry.rate_model = row.rate_model;
      entry.employment_type = row.employment_type;
      entry.isFixedRate = row.rate_model === "fixed";
    }
  }

  const summaries = Array.from(map.values()).map((entry) => {
    if (entry.rate_amount != null && entry.rate_model) {
      if (entry.rate_model === "per_course") {
        entry.estimatedAmount = entry.completedCount * entry.rate_amount;
      } else if (entry.rate_model === "hourly") {
        entry.estimatedAmount = (entry.completedMinutes / 60) * entry.rate_amount;
      } else if (entry.rate_model === "per_minute") {
        entry.estimatedAmount = entry.completedMinutes * entry.rate_amount;
      } else if (entry.rate_model === "fixed") {
        entry.estimatedAmount = entry.rate_amount;
      }
    }
    return entry;
  });

  return summaries.sort((a, b) => {
    const nameA = (a.trainer_name || a.trainer_email).toLowerCase();
    const nameB = (b.trainer_name || b.trainer_email).toLowerCase();
    return nameA.localeCompare(nameB, "de");
  });
}

export async function getCompanyMonitoring(params: {
  companyId: string;
  from: string;
  to: string;
  studioId?: string | null;
}): Promise<MonitoringRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_company_monitoring", {
    target_company_id: params.companyId,
    p_from: params.from,
    p_to: params.to,
    p_studio_id: params.studioId || null,
  });
  if (error) throw error;
  return (data ?? []) as MonitoringRow[];
}
