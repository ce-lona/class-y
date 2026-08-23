import { Button } from "@/components/ui/button";
import { t } from "@/i18n/de";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">{t.common.appName}</h1>
      <Button>{t.common.save}</Button>
    </div>
  );
}
