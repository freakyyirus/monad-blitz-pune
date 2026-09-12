interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-bg-elevated/50 px-6 py-16 text-center">
      {icon && <div className="mb-3 text-fg-faint">{icon}</div>}
      <h3 className="text-sm font-medium text-fg">{title}</h3>
      {description && <p className="mt-1 text-xs text-fg-faint">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}