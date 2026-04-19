'use client';

import React, { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Filter, Car, User, ListChecks, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { DateRange as ReactDateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

export type DateRange = ReactDateRange;

interface HandoverListToolbarProps {
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  vehicleId: string;
  setVehicleId: (id: string) => void;
  driverId: string;
  setDriverId: (id: string) => void;
  status: string;
  setStatus: (status: string) => void;
}

type Vehicle = { id: string; license_plate: string; make: string; model: string };
type Driver = { id: string; first_name: string; last_name: string };

export function HandoverListToolbar({
  dateRange,
  setDateRange,
  vehicleId,
  setVehicleId,
  driverId,
  setDriverId,
  status,
  setStatus
}: HandoverListToolbarProps) {
  const firestore = useFirestore();

  const vehiclesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'vehicles'), orderBy('license_plate')) : null, [firestore]);
  const { data: vehicles } = useCollection<Vehicle>(vehiclesQuery);

  const driversQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'drivers'), orderBy('last_name')) : null, [firestore]);
  const { data: drivers } = useCollection<Driver>(driversQuery);
  
  const isFiltered = !!dateRange || !!vehicleId || !!driverId || !!status;

  const resetFilters = () => {
    setDateRange(undefined);
    setVehicleId('');
    setDriverId('');
    setStatus('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-4 border-t border-b">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "dd. LLL, y", { locale: de })} -{" "}
                  {format(dateRange.to, "dd. LLL, y", { locale: de })}
                </>
              ) : (
                format(dateRange.from, "dd. LLL, y", { locale: de })
              )
            ) : (
              <span>Zeitraum wählen</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={setDateRange}
            numberOfMonths={2}
            locale={de}
          />
        </PopoverContent>
      </Popover>
      
       <div className="flex items-center gap-2">
         <Select value={vehicleId || 'all'} onValueChange={(value) => setVehicleId(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-[250px] data-[placeholder]:text-muted-foreground">
                <SelectValue placeholder={<div className='flex items-center gap-2'><Car className="h-4 w-4" /><span>Nach Fahrzeug filtern...</span></div>} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Alle Fahrzeuge</SelectItem>
                {vehicles?.map(v => ( <SelectItem key={v.id} value={v.id}>{v.license_plate} ({v.make} ${v.model})</SelectItem> ))}
            </SelectContent>
        </Select>
      </div>

       <div className="flex items-center gap-2">
         <Select value={driverId || 'all'} onValueChange={(value) => setDriverId(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-[250px] data-[placeholder]:text-muted-foreground">
                <SelectValue placeholder={<div className='flex items-center gap-2'><User className="h-4 w-4" /><span>Nach Fahrer filtern...</span></div>} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Alle Fahrer</SelectItem>
                {drivers?.map(d => ( <SelectItem key={d.id} value={d.id}>{d.last_name}, {d.first_name}</SelectItem> ))}
            </SelectContent>
        </Select>
      </div>
      
       <div className="flex items-center gap-2">
         <Select value={status || 'all'} onValueChange={(value) => setStatus(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-[180px] data-[placeholder]:text-muted-foreground">
                <SelectValue placeholder={<div className='flex items-center gap-2'><ListChecks className="h-4 w-4" /><span>Nach Status filtern...</span></div>} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="draft">Entwurf</SelectItem>
                <SelectItem value="new_damage">Neuer Schaden</SelectItem>
                <SelectItem value="in_review">In Prüfung</SelectItem>
                <SelectItem value="completed">Abgeschlossen</SelectItem>
                <SelectItem value="closed">Archiviert</SelectItem>
            </SelectContent>
        </Select>
      </div>

      {isFiltered && (
        <Button variant="ghost" onClick={resetFilters}>
          <X className="mr-2 h-4 w-4" />
          Filter zurücksetzen
        </Button>
      )}
    </div>
  );
}
