export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--color-accent)" />
      <path
        d="M9 12.5h3l1.6-2.5h4.8l1.6 2.5h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="var(--color-accent-ink)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="17.3" r="2.9" fill="none" stroke="var(--color-accent-ink)" strokeWidth="1.8" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
      <LogoMark />
      DSLR Snap
    </span>
  );
}
