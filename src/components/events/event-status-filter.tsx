'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VehicleEvent } from './event-form-sheet';
import { ShieldAlert } from 'lucide-react';

interface EventStatusFilterProps {
  events: VehicleEvent[] | null;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
}

const statusTranslations: { [key: string]: string } = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  done: 'Erledigt',
  verkehrsunfall: 'Unfälle',
};

const statusStyles = {
  open: {
    selected: 'bg-status-red text-white hover:bg-status-red/90 border-transparent shadow-sm font-bold',
    unselected: 'bg-status-red/15 text-status-red hover:bg-status-red/25 border-status-red/20',
  },
  in_progress: {
    selected: 'bg-status-yellow text-black hover:bg-status-yellow/90 border-transparent shadow-sm font-bold',
    unselected: 'bg-status-yellow/15 text-yellow-700 hover:bg-status-yellow/25 border-status-yellow/20',
  },
  done: {
    selected: 'bg-status-green text-white hover:bg-status-green/90 border-transparent shadow-sm font-bold',
    unselected: 'bg-status-green/15 text-status-green hover:bg-status-green/25 border-status-green/20',
  },
  verkehrsunfall: {
    selected: 'bg-red-700 text-white hover:bg-red-800 border-2 border-red-950 dark:border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.5)] font-black uppercase italic',
    unselected: 'bg-red-600/20 text-red-700 border-2 border-red-600/40 hover:bg-red-600/30 font-bold',
  },
};

export function EventStatusFilter({
  events,
  selectedStatus,
  onStatusChange,
}: EventStatusFilterProps) {
  const statusCounts = useMemo(() => {
    if (!events) {
      return { all: 0, open: 0, in_progress: 0, done: 0, verkehrsunfall: 0 };
    }
    return events.reduce(
      (acc, event) => {
        if (event.status) {
          acc[event.status as keyof typeof acc]++;
        }
        if (event.type === 'verkehrsunfall') {
          acc.verkehrsunfall++;
        }
        return acc;
      },
      { all: events.length, open: 0, in_progress: 0, done: 0, verkehrsunfall: 0 }
    );
  }, [events]);
  
  const filters = [
    { key: '', label: 'Alle' },
    { key: 'open', label: statusTranslations.open },
    { key: 'in_progress', label: statusTranslations.in_progress },
    { key: 'done', label: statusTranslations.done },
    { key: 'verkehrsunfall', label: statusTranslations.verkehrsunfall, icon: ShieldAlert },
  ];

  const getCount = (key: string) => {
      switch(key) {
          case 'open': return statusCounts.open;
          case 'in_progress': return statusCounts.in_progress;
          case 'done': return statusCounts.done;
          case 'verkehrsunfall': return statusCounts.verkehrsunfall;
          default: return statusCounts.all;
      }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {filters.map(filter => {
          // Nur anzeigen wenn Zähler > 0 oder wenn es "Alle" oder ein Status-Filter ist
          if (filter.key === 'verkehrsunfall' && statusCounts.verkehrsunfall === 0) return null;

          const isSelected = selectedStatus === filter.key;
          const styles = (statusStyles as any)[filter.key];
          
          let buttonClass = styles ? (isSelected ? styles.selected : styles.unselected) : '';

          if (!filter.key) {
            buttonClass = isSelected 
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-bold border-transparent" 
              : "bg-muted text-muted-foreground hover:bg-muted/80 border-muted";
          }

          return (
            <Button
              key={filter.key}
              variant="outline"
              size="sm"
              onClick={() => onStatusChange(filter.key)}
              className={cn("justify-start h-9 transition-all border-2", buttonClass)}
            >
              {filter.icon && <filter.icon className="mr-2 h-4 w-4" />}
              {filter.label}
              <span className={cn(
                "ml-2 text-xs font-bold px-2 py-0.5 rounded-full",
                isSelected
                    ? (filter.key === 'verkehrsunfall' ? 'bg-red-950/20 text-white' : (styles ? 'bg-white/20' : 'bg-primary-foreground/20 text-primary-foreground'))
                    : 'bg-background/50 text-foreground/70'
              )}>
                 {getCount(filter.key)}
              </span>
            </Button>
          )
      })}
    </div>
  );
}
