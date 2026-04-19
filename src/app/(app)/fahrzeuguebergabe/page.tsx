'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { HandoverList } from '@/components/handovers/handover-list';
import { HandoverListToolbar, DateRange } from '@/components/handovers/handover-list-toolbar';

export default function FahrzeuguebergabePage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [vehicleId, setVehicleId] = useState<string>('');
  const [driverId, setDriverId] = useState<string>('');
  const [status, setStatus] = useState<string>('');


  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold md:text-3xl">Fahrzeugübergaben</h1>
          <Button asChild>
            <Link href="/fahrzeuguebergabe/neu">
                <PlusCircle className="mr-2 h-4 w-4" />
                Neue Übergabe
            </Link>
          </Button>
        </div>
        
        <HandoverListToolbar 
          dateRange={dateRange}
          setDateRange={setDateRange}
          vehicleId={vehicleId}
          setVehicleId={setVehicleId}
          driverId={driverId}
          setDriverId={setDriverId}
          status={status}
          setStatus={setStatus}
        />

        <HandoverList 
          dateRange={dateRange}
          vehicleId={vehicleId}
          driverId={driverId}
          status={status}
        />
    </div>
  );
}
