'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { de } from 'date-fns/locale';
import { add, endOfMonth, startOfMonth, getYear, format } from 'date-fns';
import { DayContent, DayContentProps } from 'react-day-picker';
import { EventCalendarDay } from './event-calendar-day';
import { EventCalendarDetail } from './event-calendar-detail';
import { getHolidays } from 'feiertagejs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { TaskFormSheet } from '../tasks/task-form-sheet';
import { Timestamp } from 'firebase/firestore';

export interface CalendarEvent {
    id: string;
    kind: string;
    due_date: Timestamp;
    title?: string;
    vehicleId?: string;
    driverId?: string;
    vehicle?: any;
    sourceType: 'reminder' | 'task' | 'contract';
    link?: string;
}

const parseToDate = (ts: any): Date | null => {
    if (!ts) return null;
    if (ts instanceof Timestamp) return ts.toDate();
    if (ts?.seconds !== undefined) return new Date(ts.seconds * 1000);
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
};

export default function EventCalendar() {
  const { vehicles, tasks, contracts, reminders, isLoading } = useDashboardData();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [holidays, setHolidays] = useState<any[]>([]);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);

  useEffect(() => {
    setHolidays(getHolidays(getYear(currentMonth), 'ALL'));
  }, [currentMonth]);

  const vehiclesMap = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
  
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    const addEvent = (event: CalendarEvent) => {
        const date = parseToDate(event.due_date);
        if (!date) return;
        const dateStr = date.toISOString().split('T')[0];
        if (!map.has(dateStr)) map.set(dateStr, []);
        map.get(dateStr)?.push({
            ...event,
            vehicle: event.vehicleId ? vehiclesMap.get(event.vehicleId) : undefined
        });
    };

    reminders.forEach(r => addEvent({ ...r, sourceType: 'reminder' } as any));
    tasks.forEach(t => addEvent({ id: t.id, kind: 'task', due_date: t.due_date, title: t.title, vehicleId: t.vehicleId, sourceType: 'task', link: `/aufgaben/${t.id}` } as any));
    
    contracts.forEach(c => {
        if (c.endDate) addEvent({ id: `${c.id}-e`, kind: 'contract_end', due_date: c.endDate, title: `Vertragsende: ${c.providerName}`, vehicleId: c.vehicleId, sourceType: 'contract', link: `/vertraege/${c.id}` } as any);
        if (c.cancellationDeadline) addEvent({ id: `${c.id}-c`, kind: 'contract_deadline', due_date: c.cancellationDeadline, title: `Kündigungsfrist: ${c.providerName}`, vehicleId: c.vehicleId, sourceType: 'contract', link: `/vertraege/${c.id}` } as any);
    });
    
    return map;
  }, [reminders, tasks, contracts, vehiclesMap, currentMonth]);
  
  const selectedDayEvents = useMemo(() => {
      if (!selectedDay) return [];
      return eventsByDate.get(selectedDay.toISOString().split('T')[0]) || [];
  }, [selectedDay, eventsByDate]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg"><CalendarIcon className="h-6 w-6 text-primary" /></div>
              <div>
                <h2 className="text-xl font-bold">{format(currentMonth, 'MMMM yyyy', { locale: de })}</h2>
                <p className="text-xs text-muted-foreground">Flotten-Terminplaner</p>
              </div>
              <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/30">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(add(currentMonth, { months: -1 }))}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold" onClick={() => setCurrentMonth(new Date())}>Heute</Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(add(currentMonth, { months: 1 }))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
          </div>
          <Button onClick={() => setIsTaskSheetOpen(true)} className="shadow-md"><Plus className="mr-2 h-4 w-4" /> Neuer Termin</Button>
      </div>

      <Card className="overflow-hidden border-none shadow-xl ring-1 ring-border">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 xl:grid-cols-4">
              <div className="xl:col-span-3 border-r bg-background overflow-x-auto">
                    <Calendar
                        mode="single"
                        selected={selectedDay}
                        onSelect={setSelectedDay}
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        locale={de}
                        showWeekNumber
                        className="p-0"
                        classNames={{
                          month: "w-full space-y-0",
                          table: "w-full border-collapse",
                          head_row: "flex w-full bg-muted/30 border-b",
                          head_cell: "flex-1 text-muted-foreground font-bold text-[0.65rem] uppercase tracking-widest p-4 text-center",
                          row: "flex w-full",
                          cell: "flex-1 h-32 md:h-40 border-b border-r last:border-r-0 relative p-0 transition-all",
                          day: "h-full w-full p-0 aria-selected:opacity-100",
                          day_selected: "bg-primary/5 ring-2 ring-inset ring-primary !opacity-100",
                          day_today: "bg-accent/10",
                          weeknumber: "flex items-center justify-center text-[10px] font-bold text-muted-foreground/50 border-r bg-muted/5 w-10",
                        }}
                        components={{
                            DayContent: (props) => <EventCalendarDay {...props} events={eventsByDate.get(props.date.toISOString().split('T')[0])}><DayContent {...props} /></EventCalendarDay>,
                        }}
                    />
              </div>
              <div className="xl:col-span-1 bg-muted/20 p-6 flex flex-col min-h-[500px]">
                  <EventCalendarDetail selectedDay={selectedDay} events={selectedDayEvents} holidays={holidays} isLoading={isLoading} />
              </div>
          </div>
        </CardContent>
      </Card>
      <TaskFormSheet isOpen={isTaskSheetOpen} onOpenChange={setIsTaskSheetOpen} />
    </div>
  );
}
