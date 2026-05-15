import { Alert } from "@/components/ui/Alert";

export function SyncWarnings({ warnings }: { warnings?: string[] }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <Alert variant="warning" title="Sync warning">
      {warnings.join(". ")}. Run reconciliation to verify.
    </Alert>
  );
}
