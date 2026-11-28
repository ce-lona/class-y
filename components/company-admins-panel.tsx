"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getInitials } from "@/lib/format";
import { useCompanyAdmins } from "@/hooks/useCompanyAdmins";
import { useAuthStore } from "@/store/authStore";
import { matchesSearch, NoSearchResults, SearchInput } from "@/components/list-toolbar";
import { t } from "@/i18n/de";

/** Company-Admins der gewählten Company (Bereich „Admins“ im Team-Tab). */
export function CompanyAdminsPanel({ companyId }: { companyId: string }) {
  const { data: admins, isLoading, isError } = useCompanyAdmins(companyId);
  const myId = useAuthStore((state) => state.session?.user.id);
  const [search, setSearch] = useState("");

  if (isLoading) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (isError) return <p className="text-sm text-destructive">{t.team.loadError}</p>;

  const list = (admins ?? [])
    .filter((a) => matchesSearch(search, a.full_name, a.email))
    .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email, "de"));

  if (!admins || admins.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-10 text-center">
        <ShieldCheck className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t.team.adminsEmpty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex rounded-xl border border-border bg-card p-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t.team.searchPlaceholder}
          className="sm:ml-auto"
        />
      </div>
      {list.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <NoSearchResults onReset={() => setSearch("")} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((admin) => (
            <div
              key={admin.user_id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {getInitials(admin.full_name, admin.email)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {admin.full_name || admin.email}
                  {admin.user_id === myId && (
                    <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                      {t.team.you}
                    </span>
                  )}
                </p>
                {admin.full_name && (
                  <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">{t.team.allStudios}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
