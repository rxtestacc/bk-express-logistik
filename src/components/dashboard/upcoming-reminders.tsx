'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar, AlertTriangle, MoreHorizontal, Eye, Search, ArrowUpDown, Clock, FilterX, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { useDashboardData, ProcessedReminder } from './dashboard-data-provider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '../ui/input';
import { reminderKindTranslations } from '@/components/calendar/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type SortKey = 'kind' | 'bezug' | 'fahrzeugMarkeModell' | 'daysLeft';

const UrgencyBadge = ({ reminder }: { reminder: ProcessedReminder }) => {
    let variant: 'destructive' | 'secondary' | 'default' = 'default';
    let text = reminder.urgencyText;
    let className = 'bg-yellow-500 hover:bg-yellow-500/80 text-black'; // Medium

    if (reminder.urgency === 'overdue') {
        variant = 'destructive';
        className = 'shadow-sm animate-pulse';
    } else if (reminder.urgency === 'high') {
       className = 'bg-orange-500 hover:bg-orange-500/80 text-white';
    } else if (reminder.urgency === 'low') {
        className = 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-none';
    }

    return <Badge variant={variant} className={cn(className, 'whitespace-nowrap px-3 py-1 rounded-md text-[10px] uppercase tracking-wider')}>
        {reminder.urgency === 'overdue' && <Clock className="mr-1 h-3 w-3" />}
        {text}
    </Badge>;
}

const getGroupStyling = (type: 'overdue' | 'dueSoon' | 'upcoming') => {
    switch (type) {
        case 'overdue':
            return {
                bgColor: 'bg-destructive/10 border-destructive/20',
                textColor: 'text-destructive font-black',
                dotColor: 'bg-destructive'
            };
        case 'dueSoon':
            return {
                bgColor: 'bg-orange-500/10 border-orange-200',
                textColor: 'text-orange-700 font-bold',
                dotColor: 'bg-orange-500'
            };
        default:
             return {
                bgColor: 'bg-muted/40 border-muted',
                textColor: 'text-muted-foreground font-semibold',
                dotColor: 'bg-muted-foreground'
            };
    }
}


const ReminderTable = ({ reminders, title, type }: { reminders: ProcessedReminder[]; title: string; type: 'overdue' | 'dueSoon' | 'upcoming' }) => {
    const router = useRouter();
    const { bgColor, textColor, dotColor } = getGroupStyling(type);

    const handleNavigate = (reminder: ProcessedReminder) => {
        // Prefer sourceEventId for direct navigation to the maintenance/service record
        if (reminder.id && !reminder.id.includes('-')) {
             router.push(`/ereignisse/${reminder.id}`);
             return;
        }
        
        const link = reminder.vehicleId ? `/fahrzeuge/${reminder.vehicleId}` : reminder.driverId ? `/fahrer/${reminder.driverId}` : '#';
        if (link !== '#') {
            router.push(link);
        }
    };
    
    if (reminders.length === 0) return null;

    return (
        <>
            <TableRow className={cn('hover:bg-transparent transition-colors border-t-8 border-background select-none', bgColor)}>
                <TableCell colSpan={5} className={cn("py-2.5 px-4", textColor)}>
                    <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", dotColor)}></span>
                        <span className="uppercase tracking-[0.15em] text-[10px] font-black">{title}</span>
                        <Badge variant="outline" className="ml-1 bg-background/50 border-none text-[10px]">{reminders.length}</Badge>
                    </div>
                </TableCell>
            </TableRow>
            {reminders.map((r) => {
                 const isOverdue = r.urgency === 'overdue';

                return (
                    <TableRow 
                        key={r.id} 
                        className={cn(
                            "group transition-all duration-200 cursor-pointer hover:bg-muted/30",
                            isOverdue && "bg-destructive/[0.02] hover:bg-destructive/[0.05]"
                        )}
                        onClick={() => handleNavigate(r)}
                    >
                        <TableCell className="pl-6">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    isOverdue ? "bg-destructive/10 text-destructive" : "bg-primary/5 text-primary group-hover:bg-primary/10"
                                )}>
                                    <r.icon className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className={cn("text-sm font-semibold", isOverdue && "text-destructive")}>{r.title}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{reminderKindTranslations[r.kind] || r.kind}</span>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold tracking-tight">{r.bezug}</span>
                                <span className="text-[11px] text-muted-foreground truncate max-w-[150px]">{r.fahrzeugMarkeModell}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-sm font-medium">{format(r.dueDate, 'dd. MMMM yyyy', { locale: de })}</span>
                                <UrgencyBadge reminder={r} />
                            </div>
                        </TableCell>
                        <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                             <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleNavigate(r)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Details anzeigen
                                </DropdownMenuItem>
                                {r.vehicleId && (
                                    <DropdownMenuItem onClick={() => router.push(`/fahrzeuge/${r.vehicleId}`)}>
                                        <FilterX className="mr-2 h-4 w-4" />
                                        Zum Fahrzeug
                                    </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                )
            })}
        </>
    );
};


export function UpcomingReminders() {
  const { reminders, isLoading } = useDashboardData();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'daysLeft', direction: 'asc' });
  const [isOpen, setIsOpen] = useState(true);

  const sortedAndFilteredReminders = useMemo(() => {
    let filteredReminders = reminders ?? [];

    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filteredReminders = filteredReminders.filter(r => {
        const kindKey = r.kind ?? 'other';
        const kindLabel = reminderKindTranslations[kindKey] ?? kindKey;
        return (
          kindLabel.toLowerCase().includes(lowercasedFilter) ||
          r.title.toLowerCase().includes(lowercasedFilter) ||
          r.bezug.toLowerCase().includes(lowercasedFilter) ||
          r.fahrzeugMarkeModell.toLowerCase().includes(lowercasedFilter)
        );
      });
    }

    return filteredReminders.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        }

        return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [reminders, searchTerm, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortKey) => {
      if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-20" />;
      return <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-primary" />; 
  };


  const { overdue, dueSoon, upcoming } = useMemo(() => {
    const list = sortedAndFilteredReminders ?? [];
    // Only group if we are sorting by date (default)
    if (sortConfig.key !== 'daysLeft' || sortConfig.direction !== 'asc') {
        return { overdue: [], dueSoon: [], upcoming: list };
    }
    return {
      overdue:  list.filter(r => r.urgency === 'overdue'),
      dueSoon:  list.filter(r => r.urgency === 'high'),
      upcoming: list.filter(r => ['medium', 'low'].includes(r.urgency)),
    };
  }, [sortedAndFilteredReminders, sortConfig]);

  const totalRemindersCount = reminders?.length ?? 0;
  const showGroupedView = sortConfig.key === 'daysLeft' && sortConfig.direction === 'asc';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-none shadow-xl bg-card overflow-hidden ring-1 ring-border/50">
        <CardHeader className="border-b bg-muted/10 pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                  <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 text-primary">
                          {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </Button>
                  </CollapsibleTrigger>
                  <div className="space-y-1">
                      <CardTitle className="text-xl font-bold flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-primary" />
                          Terminübersicht
                      </CardTitle>
                      <CardDescription>Fahrzeugtermine, Wartungen und Vertragsfristen im Überblick.</CardDescription>
                  </div>
              </div>
              <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="Suche..."
                      className="pl-9 h-9 rounded-lg border-muted bg-background focus-visible:ring-primary/20"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-0">
            {isLoading && totalRemindersCount === 0 ? (
              <div className="p-8 space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : totalRemindersCount === 0 && !searchTerm ? (
              <div className="flex flex-col items-center justify-center text-center p-16 border-2 border-dashed border-muted rounded-xl m-6 h-64 bg-muted/5">
                <div className="p-4 bg-primary/5 rounded-full mb-4">
                    <Calendar className="w-10 h-10 text-primary/40" />
                </div>
                <p className="text-base font-bold text-foreground">Alles auf dem neuesten Stand!</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">Aktuell liegen keine anstehenden oder überfälligen Termine für Ihren Fuhrpark vor.</p>
              </div>
            ) : sortedAndFilteredReminders.length === 0 && searchTerm ? (
                <div className="flex flex-col items-center justify-center text-center p-12 m-6 h-64 border-2 border-dashed rounded-xl opacity-60">
                    <AlertTriangle className="w-10 h-10 text-muted-foreground mb-4" />
                    <p className="text-base font-semibold">Keine Treffer</p>
                    <p className="text-sm text-muted-foreground">Für Ihre Suche "{searchTerm}" wurden keine Termine gefunden.</p>
                    <Button variant="ghost" className="mt-4" onClick={() => setSearchTerm('')}>Suche zurücksetzen</Button>
                </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-b-0">
                            <TableHead className='font-bold text-foreground cursor-pointer h-12 pl-6' onClick={() => requestSort('kind')}>
                                <div className="flex items-center gap-1 group">
                                    Terminart {getSortIcon('kind')}
                                </div>
                            </TableHead>
                            <TableHead className='font-bold text-foreground cursor-pointer h-12' onClick={() => requestSort('bezug')}>
                                <div className="flex items-center gap-1 group">
                                    Bezug {getSortIcon('bezug')}
                                </div>
                            </TableHead>
                            <TableHead className='font-bold text-foreground cursor-pointer h-12' onClick={() => requestSort('daysLeft')}>
                                <div className="flex items-center gap-1 group">
                                    Fälligkeit {getSortIcon('daysLeft')}
                                </div>
                            </TableHead>
                            <TableHead className="text-right font-bold text-foreground h-12 pr-6">Aktion</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {showGroupedView ? (
                            <>
                                <ReminderTable reminders={overdue} title="Überfällig" type="overdue" />
                                <ReminderTable reminders={dueSoon} title="Demnächst fällig" type="dueSoon" />
                                <ReminderTable reminders={upcoming} title="Geplant" type="upcoming" />
                            </>
                        ) : (
                            <ReminderTable reminders={sortedAndFilteredReminders} title="Suchergebnisse" type="upcoming" />
                        )}
                    </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
