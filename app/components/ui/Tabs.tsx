"use client";

interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ items, active, onChange, className = "" }: TabsProps) {
  return (
    <div role="tablist" className={`flex gap-1 rounded-md bg-bg-overlay p-1 ${className}`}>
      {items.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`flex-1 rounded-[5px] px-4 py-1.5 text-sm font-medium transition-colors ${
              selected ? "bg-bg-elevated text-fg shadow-sm" : "text-fg-muted hover:text-fg"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}