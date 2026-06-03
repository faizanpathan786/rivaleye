import { useNavigate } from "react-router-dom";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-8 text-center sm:px-6">
      <div
        className="text-fg font-mono-feat tnum leading-none"
        style={{ fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif", fontSize: "clamp(72px, 22vw, 120px)", fontWeight: 600, letterSpacing: "-0.04em" }}
      >
        404
      </div>
      <p className="text-fg-muted text-sm">Page not found</p>
      <button
        type="button"
        className="re-btn re-btn-primary mt-2"
        onClick={() => navigate("/")}
      >
        Back to overview
      </button>
    </main>
  );
}
