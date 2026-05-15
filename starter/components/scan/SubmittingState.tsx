import { Spinner } from "@/components/ui/Spinner";

export function SubmittingState({ message }: { message: string }) {
  return (
    <div className="card flex items-center justify-center py-8">
      <div className="flex items-center gap-3 text-muted">
        <Spinner size="sm" />
        {message}
      </div>
    </div>
  );
}
