'use client';

import React from 'react';
import { DayContentProps } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { reminderKindColors, reminderKindTranslations } from './utils';
import type { CalendarEvent } from './event-calendar';

interface EventCalendarDayProps extends DayContentProps {
  events?: CalendarEvent[];
  children: React.ReactNode;
}

export function EventCalendarDay({ date, displayMonth, events, children }: EventCalendarDayProps) {
  const isOutside = date.getMonth() !== displayMonth.getMonth();

  return (
    <div className={cn("h-full w-full flex flex-col items-start p-2 gap-1.5 transition-colors group", {
      'opacity-40': isOutside,
    })}>
      <span className={cn(
          "text-sm font-semibold h-7 w-7 flex items-center justify-center rounded-full transition-colors",
          "group-hover:bg-muted"
      )}>
        {children}
      </span>
      
      {!isOutside && events && events.length > 0 && (
        <div className="w-full space-y-1 overflow-hidden">
          {events.slice(0, 3).map(event => (
            <div 
              key={event.id}
              className={cn(
                  "text-[9px] font-medium px-1.5 py-0.5 rounded-sm truncate w-full shadow-sm text-white",
                  reminderKindColors[event.kind] || 'bg-gray-400'
              )}
              title={`${reminderKindTranslations[event.kind] || event.kind}${event.vehicle ? ': ' + event.vehicle.license_plate : ''}`}
            >
              {reminderKindTranslations[event.kind] || event.kind}
            </div>
          ))}
          {events.length > 3 && (
            <div className="text-[9px] text-muted-foreground font-bold pl-1">
              + {events.length - 3} weitere
            </div>
          )}
        </div>
      )}
    </div>
  );
}
