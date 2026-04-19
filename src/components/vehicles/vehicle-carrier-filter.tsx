'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VehicleFormData } from './vehicle-form-sheet';

interface VehicleCarrierFilterProps {
  vehicles: (VehicleFormData & {id: string})[] | null;
  selectedCarrier: string;
  onCarrierChange: (carrier: string) => void;
}

const carrierTranslations: { [key: string]: string } = {
  GLS: 'GLS',
  Hermes: 'Hermes',
  Stadtbote: 'Stadtbote',
};

const carrierStyles: { [key: string]: { selected: string; unselected: string } } = {
  GLS: {
    selected: 'bg-amber-400 text-white hover:bg-amber-400/90 border-transparent shadow-sm font-bold',
    unselected: 'bg-amber-400/15 text-amber-700 hover:bg-amber-400/25 border-amber-400/20',
  },
  Hermes: {
    selected: 'bg-blue-400 text-white hover:bg-blue-400/90 border-transparent shadow-sm font-bold',
    unselected: 'bg-blue-400/15 text-blue-700 hover:bg-blue-400/25 border-blue-400/20',
  },
  Stadtbote: {
    selected: 'bg-slate-500 text-white hover:bg-slate-500/90 border-transparent shadow-sm font-bold',
    unselected: 'bg-slate-500/15 text-slate-700 hover:bg-slate-500/25 border-slate-500/20',
  },
};


export function VehicleCarrierFilter({
  vehicles,
  selectedCarrier,
  onCarrierChange,
}: VehicleCarrierFilterProps) {
  const carrierCounts = useMemo(() => {
    if (!vehicles) {
      return { GLS: 0, Hermes: 0, Stadtbote: 0 };
    }
    return vehicles.reduce(
      (acc, vehicle) => {
        if (vehicle.carrier) {
          acc[vehicle.carrier] = (acc[vehicle.carrier] || 0) + 1;
        }
        return acc;
      },
      { GLS: 0, Hermes: 0, Stadtbote: 0 } as Record<string, number>
    );
  }, [vehicles]);
  
  const filters = [
    { key: '', label: 'Alle Zusteller' },
    { key: 'GLS', label: carrierTranslations.GLS },
    { key: 'Hermes', label: carrierTranslations.Hermes },
    { key: 'Stadtbote', label: carrierTranslations.Stadtbote },
  ];

  const getCount = (key: string) => {
      if (!key) return vehicles?.length || 0;
      return carrierCounts[key] || 0;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map(filter => {
          if (filter.key && getCount(filter.key) === 0) return null;

          const isSelected = selectedCarrier === filter.key;
          const styles = (carrierStyles as any)[filter.key];
          
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
              onClick={() => onCarrierChange(filter.key)}
              className={cn("justify-start transition-all border-2", buttonClass)}
            >
              {filter.label}
              <span className={cn(
                "ml-2 text-xs font-bold px-2 py-0.5 rounded-full",
                isSelected
                    ? 'bg-white/20 text-white'
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
