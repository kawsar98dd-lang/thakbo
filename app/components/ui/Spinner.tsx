import { cx } from "~/lib/utils";

export function Spinner({ className = "size-4", label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} aria-label={label} className="inline-flex">
      <svg viewBox="0 0 24 24" className={cx("animate-spin", className)} fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
