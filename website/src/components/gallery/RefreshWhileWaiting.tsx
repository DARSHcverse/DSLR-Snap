"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-checks every few seconds while the booth is still uploading; gives up after 15 minutes. */
export function RefreshWhileWaiting() {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      if (Date.now() - started > 15 * 60_000) {
        clearInterval(t);
        setGaveUp(true);
      } else router.refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <p className="mt-6 text-sm text-muted">
      {gaveUp ? "Still not here: the booth may be offline. Open this link again later; it keeps working." : "This page updates by itself."}
    </p>
  );
}
