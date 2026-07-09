import { type LucideIcon, Inbox } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 text-center ${className}`}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)]">
        <Icon className="h-6 w-6 text-[var(--ink-400)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--ink-950)]">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-[var(--ink-500)]">
          {description}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
