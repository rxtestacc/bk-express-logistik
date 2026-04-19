'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VehicleEvents from './vehicle-events';
import { VehicleHistoryToolbar } from './vehicle-history-toolbar';
import type { VehicleEvent } from '@/components/events/event-form-sheet';
import { VehicleHandoversList } from './vehicle-handovers-list';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { Badge } from '@/components/ui/badge';

interface VehicleHistoryProps {
  vehicleId: string;
  onEditEvent: (event: VehicleEvent) => void;
}

const maintenanceEventTypes = ['inspection', 'repair', 'tuv', 'au', 'uvv', 'tire_change', 'service'];
const damageEventTypes = ['damage', 'verkehrsunfall', 'other'];

export default function VehicleHistory({ vehicleId, onEditEvent }: VehicleHistoryProps) {
  const [activeTab, setActiveTab] = useState('maintenance');
  const [filterText, setFilterText] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  
  const { events, handovers } = useDashboardData();

  const maintenanceCount = useMemo(() => 
    events.filter(e => e.vehicleId === vehicleId && maintenanceEventTypes.includes(e.type)).length,
    [events, vehicleId]
  );

  const damageCount = useMemo(() => 
    events.filter(e => e.vehicleId === vehicleId && damageEventTypes.includes(e.type)).length,
    [events, vehicleId]
  );

  const handoverCount = useMemo(() => 
    handovers.filter(h => h.vehicleId === vehicleId).length,
    [handovers, vehicleId]
  );

  const currentEventTypes = useMemo(() => {
    if (activeTab === 'maintenance') return maintenanceEventTypes;
    if (activeTab === 'damages') return damageEventTypes;
    return []; // For handovers tab
  }, [activeTab]);

  // Reset filters when tab changes
  const handleTabChange = (value: string) => {
      setActiveTab(value);
      setFilterText('');
      setSelectedTypes([]);
  }

  return (
    <Card className="border-primary/5 shadow-sm">
      <CardHeader>
        <CardTitle>Fahrzeughistorie</CardTitle>
        <CardDescription>
          Eine Übersicht aller erfassten Ereignisse für dieses Fahrzeug.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="maintenance" className="relative data-[state=active]:shadow-md">
                Wartung
                {maintenanceCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border-none shadow-none">
                        {maintenanceCount}
                    </Badge>
                )}
            </TabsTrigger>
            <TabsTrigger value="damages" className="relative data-[state=active]:shadow-md">
                Schäden
                {damageCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border-none shadow-none">
                        {damageCount}
                    </Badge>
                )}
            </TabsTrigger>
            <TabsTrigger value="handovers" className="relative data-[state=active]:shadow-md">
                Übergaben
                {handoverCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border-none shadow-none">
                        {handoverCount}
                    </Badge>
                )}
            </TabsTrigger>
          </TabsList>

          {/* Toolbar is only shown for event lists */}
          {activeTab !== 'handovers' && (
             <VehicleHistoryToolbar
                filterText={filterText}
                setFilterText={setFilterText}
                availableTypes={currentEventTypes}
                selectedTypes={selectedTypes}
                setSelectedTypes={setSelectedTypes}
              />
          )}

          <TabsContent value="maintenance" className="mt-0 animate-in fade-in duration-300">
            <VehicleEvents 
                vehicleId={vehicleId} 
                filterText={filterText}
                eventTypes={selectedTypes.length > 0 ? selectedTypes : maintenanceEventTypes}
                onEditEvent={onEditEvent}
            />
          </TabsContent>
          <TabsContent value="damages" className="mt-0 animate-in fade-in duration-300">
             <VehicleEvents 
                vehicleId={vehicleId} 
                filterText={filterText}
                eventTypes={selectedTypes.length > 0 ? selectedTypes : damageEventTypes}
                onEditEvent={onEditEvent}
            />
          </TabsContent>
          <TabsContent value="handovers" className="mt-0 animate-in fade-in duration-300">
            <VehicleHandoversList vehicleId={vehicleId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
