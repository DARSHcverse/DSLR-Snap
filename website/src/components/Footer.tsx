import { site } from "@/lib/site";
import { Logo } from "./Logo";

// Cached so the page can stay static; Next refreshes it on revalidation.
async function CopyrightYear() {
  "use cache";
  return new Date().getFullYear();
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-sm text-muted">Photo booth software for Windows.</p>
        </div>
        <div className="flex flex-col gap-1 text-sm text-muted sm:items-end">
          <a href={`mailto:${site.contactEmail}`} className="hover:text-fg">
            {site.contactEmail}
          </a>
          <p>
            © <CopyrightYear /> {site.name}. Canon, DNP and Windows are trademarks of their
            respective owners.
          </p>
        </div>
      </div>
    </footer>
  );
}
