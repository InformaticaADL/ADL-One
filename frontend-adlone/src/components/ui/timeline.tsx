import * as React from 'react';

import { cn } from '@/lib/utils';

export interface TimelineItem {
  key?: React.Key;
  dot?: React.ReactNode;
  color?: string;
  content: React.ReactNode;
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

// Minimal vertical stepper for action-history / audit-trail lists — a dot +
// connecting line per entry, each with arbitrary content on the right.
export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {items.map((item, i) => (
        <li key={item.key ?? i} className="relative flex gap-3 pb-5 last:pb-0">
          {i < items.length - 1 && (
            <span className="absolute left-[5px] top-3 h-[calc(100%-4px)] w-px bg-border" />
          )}
          <span className="relative mt-1 flex h-3 w-3 shrink-0 items-center justify-center">
            {item.dot ?? (
              <span
                className="h-2.5 w-2.5 rounded-full border-2 border-background"
                style={{ backgroundColor: item.color ?? 'var(--sc-muted-foreground)' }}
              />
            )}
          </span>
          <div className="min-w-0 flex-1">{item.content}</div>
        </li>
      ))}
    </ol>
  );
}
