"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/hooks/useStudios";
import { useActiveCoursePlan } from "@/hooks/useCoursePlans";
import { formatAddress } from "@/lib/address";
import { t } from "@/i18n/de";

export default function StudioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: studio, isLoading } = useStudio(id);
  const { data: plan } = useActiveCoursePlan(id);

  if (isLoading) {
    return <p className="text-muted-foreground">{t.common.loading}</p>;
  }

  if (!studio) return null;

  const createdAt = new Date(studio.created_at).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/studios"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        {t.studioAdmin.backToStudios}
      </Link>

      <div className="mb-7 flex items-center justify-between">
        <h1 className="font-heading text-[28px] font-extrabold">{studio.name}</h1>
        <Button variant="outline" size="sm">
          <Pencil className="size-3.5" />
          {t.studioAdmin.edit}
        </Button>
      </div>

      <div className="mb-6 flex gap-10 rounded-xl border border-border bg-card p-5">
        <div>
          <div className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {t.studioAdmin.address}
          </div>
          <div className="text-sm">{formatAddress(studio) ?? "—"}</div>
        </div>
        <div>
          <div className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {t.studioAdmin.createdAt}
          </div>
          <div className="text-sm">{createdAt}</div>
        </div>
      </div>

      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="font-heading text-[17px] font-bold">{t.studioAdmin.currentPlan}</h2>
      </div>
      <div className="mb-7 rounded-xl border border-border bg-card p-5">
        {plan ? (
          <p className="text-sm text-muted-foreground">
            {t.studioAdmin.activePlanSince}{" "}
            {new Date(plan.valid_from).toLocaleDateString("de-DE")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t.studioAdmin.noCurrentPlan}</p>
        )}
      </div>

      <h2 className="mb-3.5 font-heading text-[17px] font-bold">
        {t.studioAdmin.trainersAtStudio}
      </h2>
      <p className="text-sm text-muted-foreground">{t.studioAdmin.noTrainers}</p>
    </div>
  );
}
