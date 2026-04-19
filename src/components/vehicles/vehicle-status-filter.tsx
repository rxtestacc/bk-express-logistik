'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VehicleFormData } from './vehicle-form-sheet';

interface VehicleStatusFilterProps {
  vehicles: (VehicleFormData & {id: string})[] | null;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
}

const statusTranslations: { [key: string]: string } = {
  aktiv: 'Aktiv',
  in_werkstatt: 'In Werkstatt',
  inaktiv: 'Inaktiv',
};

const statusStyles: { [key: string]: { selected: string; unselected: string } } = {
  aktiv: {
    selected: 'bg-status-green text-white hover:bg-status-green/90 border-transparent shadow-sm font-bold',
    unselected: 'bg-status-green/15 text-status-green hover:bg-status-green/25 border-status-green/20',
  },
  in_werkstatt: {
    selected: 'bg-status-yellow text-black hover:bg-status-yellow/90 border-transparent shadow-sm font-bold',
    unselected: 'bg-status-yellow/15 text-yellow-700 hover:bg-status-yellow/25 border-status-yellow/20',
  },
  inaktiv: {
    selected: 'bg-status-red text-white hover:bg-status-red/90 border-transparent shadow-sm font-bold',
    unselected: 'bg-status-red/15 text-status-red hover:bg-status-red/25 border-status-red/20',
  },
};


export function VehicleStatusFilter({
  vehicles,
  selectedStatus,
  onStatusChange,
}: VehicleStatusFilterProps) {
  const statusCounts = useMemo(() => {
    if (!vehicles) {
      return { all: 0, aktiv: 0, in_werkstatt: 0, inaktiv: 0 };
    }
    return vehicles.reduce(
      (acc, vehicle) => {
        if (vehicle.status) {
          acc[vehicle.status]++;
        }
        return acc;
      },
      { all: vehicles.length, aktiv: 0, in_werkstatt: 0, inaktiv: 0 }
    );
  }, [vehicles]);
  
  const filters = [
    { key: '', label: 'Alle' },
    { key: 'aktiv', label: statusTranslations.aktiv },
    { key: 'in_werkstatt', label: statusTranslations.in_werkstatt },
    { key: 'inaktiv', label: statusTranslations.inaktiv },
  ];

  const getCount = (key: string) => {
      switch(key) {
          case 'aktiv': return statusCounts.aktiv;
          case 'in_werkstatt': return statusCounts.in_werkstatt;
          case 'inaktiv': return statusCounts.inaktiv;
          default: return statusCounts.all;
      }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map(filter => {
          const isSelected = selectedStatus === filter.key;
          const styles = (statusStyles as any)[filter.key];
          
          let buttonClass = styles ? (isSelected ? styles.selected : styles.unselected) : '';
          
          // Style for "Alle" button
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
              className={cn("justify-start transition-all border-2", buttonClass)}
            >
              {filter.label}
              <span className={cn(
                "ml-2 text-xs font-bold px-2 py-0.5 rounded-full",
                isSelected
                    ? (styles ? (filter.key === 'in_werkstatt' ? 'bg-black/10' : 'bg-white/20') : 'bg-primary-foreground/20 text-primary-foreground')
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
