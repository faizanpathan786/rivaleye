// src/components/react/EmailForm.tsx
import { type FormEvent } from 'react';

export default function EmailForm() {

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const appUrl = (import.meta.env.PUBLIC_APP_URL || 'http://localhost:4004').toString();
    window.location.href = `${appUrl}/signin`;
  };

  return (
    <form onSubmit={onSubmit} noValidate className="w-full flex flex-col items-center gap-6">
      <button
        type="submit"
        className="group relative min-h-[48px] flex items-center justify-center bg-[var(--color-lime)] text-[var(--color-bg-0)] px-5 md:px-7 py-3 font-mono text-[11px] font-medium tracking-[0.22em] uppercase hover:bg-[var(--color-lime-1)] transition-colors whitespace-nowrap"
      >
        <span className="inline-flex items-center gap-2">
          Run a scan
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M2 6h8m0 0L7 3m3 3L7 9" strokeLinecap="square" />
          </svg>
        </span>
      </button>

      <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--color-fg-3)]">
        ↳ Free first scan · no card required · 4-minute setup
      </p>
    </form>
  );
}
