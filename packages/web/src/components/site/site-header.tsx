import { Link } from "react-router-dom";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link
          to="/"
          className="inline-flex min-h-[36px] items-center font-mono text-sm font-semibold tracking-tight text-foreground"
        >
          RivalEye
        </Link>
        <Link
          to="/history"
          className="inline-flex min-h-[36px] items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Recent reports
        </Link>
      </div>
    </header>
  );
}
