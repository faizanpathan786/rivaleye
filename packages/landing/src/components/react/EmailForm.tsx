// src/components/react/EmailForm.tsx
import { useState, type FormEvent } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type State = { status: 'idle' | 'invalid' | 'submitting' | 'success'; message?: string };

export default function EmailForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setState({ status: 'invalid', message: 'That doesn\'t look like an email.' });
      return;
    }
    setState({ status: 'submitting' });
    // Simulate API call — no backend in this demo
    await new Promise((res) => setTimeout(res, 700));
    setState({ status: 'success', message: 'You\'re in. Check your inbox in ~60 seconds.' });
    setEmail('');
  };

  if (state.status === 'success') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border border-[var(--color-lime)] bg-[var(--color-lime)]/[0.06] p-5 sm:p-6 md:p-7"
      >
        <div className="flex items-center gap-2 mb-3">
          <svg
            viewBox="0 0 14 14"
            className="w-3.5 h-3.5 text-[var(--color-lime)]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M2 7l3 3 7-7" strokeLinecap="square" />
          </svg>
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--color-lime)]">
            scan queued
          </span>
        </div>
        <p className="text-[16px] leading-[1.5] text-[var(--color-fg-0)] mb-3 break-words">{state.message}</p>
        <p className="font-mono text-[11px] text-[var(--color-fg-3)] break-words">
          {'↳ We\'ll send a magic link to start your first scan. No password needed.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <label htmlFor="email-input" className="label-mono block mb-3">
        ▼ work email
      </label>
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-0">
        <div
          className={`flex items-stretch flex-1 min-w-0 border bg-[var(--color-bg-0)] transition-colors ${
            state.status === 'invalid'
              ? 'border-[var(--color-rose)]'
              : 'border-[var(--color-line-3)] focus-within:border-[var(--color-lime)]'
          }`}
        >
          <span className="flex items-center px-4 text-[var(--color-lime)] font-mono select-none">
            {'>'}
          </span>
          <input
            id="email-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state.status === 'invalid') setState({ status: 'idle' });
            }}
            placeholder="you@startup.co"
            aria-invalid={state.status === 'invalid'}
            aria-describedby={state.status === 'invalid' ? 'email-error' : undefined}
            className="flex-1 min-w-0 w-full bg-transparent border-0 outline-none py-4 pr-4 font-mono text-[15px] text-[var(--color-fg-0)] placeholder:text-[var(--color-fg-4)]"
          />
        </div>
        <button
          type="submit"
          disabled={state.status === 'submitting'}
          className="group relative w-full sm:w-auto min-h-[48px] flex items-center justify-center bg-[var(--color-lime)] text-[var(--color-bg-0)] px-5 md:px-7 py-3 sm:py-0 font-mono text-[11px] font-medium tracking-[0.22em] uppercase hover:bg-[var(--color-lime-1)] disabled:opacity-60 transition-colors whitespace-nowrap"
        >
          {state.status === 'submitting' ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 bg-[var(--color-bg-0)] animate-blink" />
              queuing
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              Run a scan
              <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M2 6h8m0 0L7 3m3 3L7 9" strokeLinecap="square" />
              </svg>
            </span>
          )}
        </button>
      </div>

      {state.status === 'invalid' && (
        <p
          id="email-error"
          role="alert"
          className="mt-3 font-mono text-[11px] tracking-wide text-[var(--color-rose)] break-words"
        >
          ✕ {state.message}
        </p>
      )}

      <p className="mt-4 font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--color-fg-3)]">
        ↳ Free first scan · no card required · 4-minute setup
      </p>
    </form>
  );
}
