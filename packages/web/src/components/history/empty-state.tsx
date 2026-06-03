import { Link } from "react-router-dom";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-10 text-center md:py-16">
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
