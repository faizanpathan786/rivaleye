import { Link } from "react-router-dom";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-muted-foreground">No scans yet.</p>
      <Link
        to="/scan"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        Run your first scan →
      </Link>
    </div>
  );
}
