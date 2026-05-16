import { Link } from "react-router-dom";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link to="/" className="font-mono text-sm font-semibold tracking-tight text-foreground">
          RivalEye
        </Link>
        <Link
          to="/history"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Recent reports
        </Link>
      </div>
    </header>
  );
}
