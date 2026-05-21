import { useState, type FormEvent } from "react";

interface EmailFormProps {
  variant?: "hero" | "band";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailForm({ variant = "hero" }: EmailFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onBand = variant === "band";

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setDone(true);
  }

  if (done) {
    return (
      <p
        className={
          onBand
            ? "text-base font-medium text-white"
            : "text-base font-medium text-ink"
        }
      >
        Thanks — we'll be in touch.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
      noValidate
    >
      <div className="flex-1">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          placeholder="you@company.com"
          aria-label="Work email"
          className={
            "w-full rounded-lg border px-4 py-3 text-sm outline-none transition-shadow focus:ring-2 " +
            (onBand
              ? "border-white/30 bg-white/10 text-white placeholder:text-white/60 focus:ring-white/40"
              : "border-line bg-surface text-ink placeholder:text-muted focus:ring-accent/30")
          }
        />
        {error ? (
          <p
            className={
              "mt-1 text-xs " + (onBand ? "text-white/90" : "text-red-600")
            }
          >
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        className={
          "rounded-lg px-5 py-3 text-sm font-semibold transition-colors " +
          (onBand
            ? "bg-white text-accent hover:bg-white/90"
            : "bg-accent text-white hover:bg-accent-hover")
        }
      >
        Get early access
      </button>
    </form>
  );
}
