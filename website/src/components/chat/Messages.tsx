import type { Message } from "@/lib/support";

const time = (t: string) => new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/** Chat bubbles. "Mine" sit on the right in the accent tint; the other side on the left. */
export function Messages({ messages, mine, otherName }: { messages: Message[]; mine: "admin" | "customer"; otherName: string }) {
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) => {
        const isMine = (mine === "admin") === m.from_admin;
        return (
          <li key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words ${isMine ? "rounded-br-md bg-accent/15 text-fg" : "rounded-bl-md bg-surface-2 text-fg"}`}>
              {m.body}
            </div>
            <span className="mt-1 px-1 text-xs text-muted">{isMine ? "You" : otherName} · {time(m.created_at)}</span>
          </li>
        );
      })}
    </ol>
  );
}
