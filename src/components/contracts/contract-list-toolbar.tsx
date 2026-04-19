'use client';

import React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Filter, Car, User, ListChecks, X, FileText, AlertCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { DateRange as ReactDateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import type { Contract, Vehicle } from '@/lib/types';
import { useMemo } from 'react';

export type DateRange = ReactDateRange;

interface ContractListToolbarProps {
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  vehicleId: string;
  setVehicleId: (id: string) => void;
  contractType: string;
  setContractType: (type: string) => void;
  providerName: string;
  setProviderName: (name: string) => void;
  contractStatus: string;
  setContractStatus: (status: string) => void;
  matchStatus: string;
  setMatchStatus: (status: string) => void;
}


const contractTypeTranslations: { [key: string]: string } = {
    leasing: 'Leasing',
    financing: 'Finanzierung',
    purchase: 'Kauf',
    warranty: 'Garantie',
    maintenance: 'Wartung',
    insurance: 'Versicherung',
    other: 'Sonstiges',
};

const contractStatusTranslations: { [key: string]: string } = {
    active: 'Aktiv',
    expiring_soon: 'Läuft bald aus',
    expired: 'Abgelaufen',
};

const matchStatusTranslations: { [key: string]: string } = {
    unverified: 'Ungeprüft',
    verified: 'Geprüft',
    corrected: 'Korrigiert',
};


export function ContractListToolbar({
  dateRange,
  setDateRange,
  vehicleId,
  setVehicleId,
  contractType,
  setContractType,
  providerName,
  setProviderName,
  contractStatus,
  setContractStatus,
  matchStatus,
  setMatchStatus
}: ContractListToolbarProps) {
  const firestore = useFirestore();

  const vehiclesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'vehicles'), orderBy('license_plate')) : null, [firestore]);
  const { data: vehicles } = useCollection<Vehicle>(vehiclesQuery);

  const contractsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'contracts')) : null, [firestore]);
  const { data: contracts } = useCollection<Contract>(contractsQuery);

  const uniqueProviders = useMemo(() => {
    if (!contracts) return [];
    const providers = contracts.map(c => c.providerName).filter((p): p is string => !!p);
    return [...new Set(providers)].sort();
  }, [contracts]);

  const isFiltered = !!dateRange || !!vehicleId || !!contractType || !!providerName || !!contractStatus || !!matchStatus;

  const resetFilters = () => {
    setDateRange(undefined);
    setVehicleId('');
    setContractType('');
    setProviderName('');
    setContractStatus('');
    setMatchStatus('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-4 border-t border-b">
        <Filter className="h-5 w-5 text-muted-foreground shrink-0" />
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
              <span>Filter nach Zeitraum</span>
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
      
       <Select value={vehicleId || 'all'} onValueChange={(value) => setVehicleId(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-full sm:w-auto md:w-[250px] data-[placeholder]:text-muted-foreground">
                <SelectValue placeholder={<div className='flex items-center gap-2'><Car className="h-4 w-4" /><span>Nach Fahrzeug filtern...</span></div>} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Alle Fahrzeuge</SelectItem>
                {vehicles?.map(v => ( <SelectItem key={v.id} value={v.id}>{v.license_plate} ({v.make} {v.model})</SelectItem> ))}
            </SelectContent>
        </Select>

        <Select value={contractType || 'all'} onValueChange={(value) => setContractType(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-full sm:w-auto md:w-[180px] data-[placeholder]:text-muted-foreground">
                <SelectValue placeholder={<div className='flex items-center gap-2'><FileText className="h-4 w-4" /><span>Nach Vertragsart...</span></div>} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Alle Vertragsarten</SelectItem>
                {Object.entries(contractTypeTranslations).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
            </SelectContent>
        </Select>

        <Select value={providerName || 'all'} onValueChange={(value) => setProviderName(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-full sm:w-auto md:w-[200px] data-[placeholder]:text-muted-foreground">
                <SelectValue placeholder={<div className='flex items-center gap-2'><User className="h-4 w-4" /><span>Nach Partner...</span></div>} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Alle Partner</SelectItem>
                {uniqueProviders.map(provider => (
                    <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                ))}
            </SelectContent>
        </Select>
        
         <Select value={contractStatus || 'all'} onValueChange={(value) => setContractStatus(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-full sm:w-auto md:w-[180px] data-[placeholder]:text-muted-foreground">
                <SelectValue placeholder={<div className='flex items-center gap-2'><ListChecks className="h-4 w-4" /><span>Nach Status...</span></div>} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {Object.entries(contractStatusTranslations).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
            </SelectContent>
        </Select>

        <Select value={matchStatus || 'all'} onValueChange={(value) => setMatchStatus(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-full sm:w-auto md:w-[180px] data-[placeholder]:text-muted-foreground">
                <SelectValue placeholder={<div className='flex items-center gap-2'><AlertCircle className="h-4 w-4" /><span>Nach Prüfstatus...</span></div>} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Alle Prüfstatus</SelectItem>
                 {Object.entries(matchStatusTranslations).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
            </SelectContent>
        </Select>


      {isFiltered && (
        <Button variant="ghost" onClick={resetFilters}>
          <X className="mr-2 h-4 w-4" />
          Filter zurücksetzen
        </Button>
      )}
    </div>
  );
}
