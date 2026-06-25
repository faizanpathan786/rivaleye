// src/components/react/EmailForm.tsx
import { type FormEvent } from 'react';

export default function EmailForm() {

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const appUrl = (import.meta.env.PUBLIC_APP_URL || 'http://localhost:4004').toString();
    window.location.href = `${appUrl}/signin`;
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--color-fg-3)]">
        ↳ Free first scan · no card required · 4-minute setup
      </p>
    </div>
  );
}
