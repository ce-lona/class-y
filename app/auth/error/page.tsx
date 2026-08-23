export default function AuthErrorPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold">Link ungültig oder abgelaufen</h1>
      <p className="text-muted-foreground">
        Bitte fordere einen neuen Bestätigungs- oder Reset-Link an.
      </p>
    </div>
  );
}
