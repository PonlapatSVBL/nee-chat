export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-input/60 bg-muted/50 px-6 py-10 text-center">
      <p className="text-base font-medium">{title}</p>
      {description && <p className="max-w-[32ch] text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
