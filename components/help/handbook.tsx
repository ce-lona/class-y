"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chaptersForRole, type HandbookChapter } from "@/constants/help";
import type { HelpRole } from "@/hooks/useWorkspace";
import { t } from "@/i18n/de";

const chapterTexts = t.help.handbook.chapters;

function Screenshot({ name, alt }: { name: string; alt: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-background">
      {/* eslint-disable-next-line @next/next/no-img-element -- statische Bilder aus public/handbook, Größe unbekannt */}
      <img
        src={`/handbook/${name}.png`}
        alt={alt}
        loading="lazy"
        className="block h-auto w-full"
        onError={() => setMissing(true)}
      />
    </figure>
  );
}

function ChapterArticle({
  chapter,
  onBack,
  onContact,
}: {
  chapter: HandbookChapter;
  onBack: () => void;
  onContact: () => void;
}) {
  const text = chapterTexts[chapter.id];
  return (
    <article className="grid gap-5">
      <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={onBack}>
        <ChevronLeft className="size-4" />
        {t.help.handbook.back}
      </Button>
      <div>
        <h2 className="font-heading text-xl font-bold">{text.title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{text.summary}</p>
      </div>
      <ol className="grid gap-6">
        {text.steps.map((stepText, i) => {
          const shot = chapter.shots[i];
          return (
            <li key={i} className="grid gap-3">
              <p className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span>{stepText}</span>
              </p>
              {shot && (
                <Screenshot
                  name={shot}
                  alt={t.help.handbook.screenshotAlt
                    .replace("{title}", text.title)
                    .replace("{step}", String(i + 1))}
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm">
        {t.help.handbook.notHelpful}{" "}
        <button type="button" className="font-semibold text-primary underline-offset-4 hover:underline" onClick={onContact}>
          {t.help.handbook.writeUs}
        </button>
      </p>
    </article>
  );
}

export function Handbook({ role, onContact }: { role: HelpRole; onContact: () => void }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<HandbookChapter["id"] | null>(null);

  const chapters = useMemo(() => chaptersForRole(role), [role]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter((c) => {
      const text = chapterTexts[c.id];
      return [text.title, text.summary, ...text.steps].join(" ").toLowerCase().includes(q);
    });
  }, [chapters, query]);

  const open = chapters.find((c) => c.id === openId);
  if (open) {
    return <ChapterArticle chapter={open} onBack={() => setOpenId(null)} onContact={onContact} />;
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <BookOpen className="size-5 text-primary" />
          {t.help.handbook.title}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.help.handbook.subtitle}</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.help.handbook.searchPlaceholder}
          aria-label={t.help.handbook.searchLabel}
          className="pl-9"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted-foreground">{t.help.handbook.empty}</p>
      ) : (
        <ul className="-mx-2 grid gap-0.5">
          {filtered.map((c) => {
            const Icon = c.icon;
            const text = chapterTexts[c.id];
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(c.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading text-sm font-bold">{text.title}</span>
                    <span className="block text-sm text-muted-foreground">{text.summary}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
