"use client";

import type { ReactNode } from "react";

/** A submit button that asks first, for actions that can't be undone. */
export function ConfirmButton({ message, className, children, name, value }: { message: string; className?: string; children: ReactNode; name?: string; value?: string }) {
  return (
    <button name={name} value={value} className={className} onClick={(e) => !confirm(message) && e.preventDefault()}>
      {children}
    </button>
  );
}
