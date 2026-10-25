import Image from "next/image";
import wordmark from "./logo-wordmark.png";

// Brand source files live in /brand at the repo root.
export function Logo() {
  return <Image src={wordmark} alt="DSLR Snap" priority className="h-8 w-auto" />;
}
