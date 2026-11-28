"use client";

import { useState } from "react";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAddPlatformAdmin,
  usePlatformAdmins,
  useRemovePlatformAdmin,
} from "@/hooks/usePlatformAdmins";
import { useAuthStore } from "@/store/authStore";
import { t } from "@/i18n/de";

/** Plattform-Einstellungen: weitere Plattform-Admins (z. B. Mitarbeiter:innen) verwalten. */
export function PlatformAdminsCard() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: admins, isLoading } = usePlatformAdmins();
  const add = useAddPlatformAdmin();
  const remove = useRemovePlatformAdmin();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!email.trim()) return;
    try {
      const result = await add.mutateAsync(email);
      setEmail("");
      setMessage({
        text: result.invited ? t.roleModel.platformAdminInvited : t.roleModel.platformAdminAdded,
        error: false,
      });
    } catch (error) {
      console.error(error);
      setMessage({ text: t.roleModel.platformAdminAddError, error: true });
    }
  }

  async function handleRemove(id: string) {
    setMessage(null);
    try {
      await remove.mutateAsync(id);
    } catch (error) {
      console.error(error);
      setMessage({ text: t.roleModel.platformAdminRemoveError, error: true });
    }
  }

  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6"
      data-testid="platform-admins"
    >
      <div>
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <ShieldCheck className="size-5 text-primary" />
          <span>{t.roleModel.platformAdminsTitle}</span>
        </h2>
        <p className="text-sm text-muted-foreground">{t.roleModel.platformAdminsHint}</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {(admins ?? []).map((admin) => (
            <li key={admin.user_id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {admin.full_name || admin.email}
                  {admin.user_id === userId && (
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      ({t.roleModel.platformAdminYou})
                    </span>
                  )}
                </p>
                {admin.full_name && (
                  <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
                )}
              </div>
              {(admins ?? []).length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => handleRemove(admin.user_id)}
                  className="gap-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  <span>{t.roleModel.platformAdminRemove}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="platform-admin-email">{t.roleModel.platformAdminEmail}</Label>
          <Input
            id="platform-admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={add.isPending || !email.trim()} className="gap-1.5">
          <UserPlus className="size-4" />
          <span>{t.roleModel.platformAdminAdd}</span>
        </Button>
      </form>

      {message && (
        <p className={message.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message.text}
        </p>
      )}
    </section>
  );
}
