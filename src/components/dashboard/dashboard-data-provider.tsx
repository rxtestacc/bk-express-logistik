'use client';

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, WithId } from '@/firebase';
import { collection, query, where, orderBy, Timestamp, limit } from 'firebase/firestore';
import { differenceInCalendarDays, startOfDay, startOfMonth, endOfMonth, subMonths, isWithinInterval, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { kindIcons, reminderKindTranslations } from '@/components/calendar/utils';
import { useSession } from '@/hooks/use-session';

// --- Datentypen ---
export interface Vehicle {
  id: string;
  vin: string;
  hsn?: string;
  tsn?: string;
  license_plate: string;
  make: string;
  model: string;
  variant?: string;
  year?: number;
  first_registration: Timestamp | null;
  engine?: string;
  fuel_type?: 'Benzin' | 'Diesel' | 'Elektro' | 'Hybrid' | 'LPG' | 'CNG';
  power_kw?: number;
  color?: string;
  mileage_km: number;
  mileage_updated_at?: Timestamp;
  status: 'aktiv' | 'in_werkstatt' | 'inaktiv';
  carrier?: 'GLS' | 'Hermes' | 'Stadtbote';
  location?: string;
  notes?: string;
  acquisition_type?: 'cash' | 'leasing' | 'financing';
  purchase_date?: Timestamp;
  purchase_price?: number;
  leasing_start?: Timestamp;
  leasing_end?: Timestamp;
  leasing_rate_eur?: number;
  leasing_annual_mileage?: number;
  leasing_company?: string;
  financing_start?: Timestamp;
  financing_end?: Timestamp;
  financing_rate_eur?: number;
  financing_bank?: string;
  warranty_end?: Timestamp;
  tuv_due: Timestamp | null;
  open_tasks_count?: number;
  total_costs_eur?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'done';
  due_date: Timestamp;
  assignee_name: string;
  vehicleId?: string;
  driverId?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  created_by_name?: string;
  completed_by_name?: string | null;
  completed_at?: Timestamp | null;
  created_via?: string;
}

export interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: Timestamp | null;
  birth_place?: string;
  nationality?: string;
  employment_start_date?: Timestamp | null;
  address?: {
    street: string;
    zip: string;
    city: string;
  };
  phone: string;
  email?: string;
  carrier?: 'GLS' | 'Hermes' | 'Stadtbote';
  license_number?: string;
  license_issue_date?: Timestamp | null;
  license_expiry_date?: Timestamp | null;
  license_issue_country?: string;
  license_classes: string[];
  assigned_vehicle_ids?: string[];
  employee_number?: string;
  zsb?: string;
  health_insurance?: string;
}

export interface VehicleEvent {
    id: string;
    vehicleId: string;
    driverId?: string;
    type: 'inspection' | 'repair' | 'damage' | 'tuv' | 'au' | 'uvv' | 'tire_change' | 'service' | 'fuel' | 'trip' | 'other' | 'verkehrsunfall';
    title: string;
    due_date: Timestamp;
    odometer_km: number;
    cost_eur: number;
    status: 'open' | 'in_progress' | 'done';
    vendor?: string;
    notes?: string;
    created_at?: Timestamp;
    updated_at?: Timestamp;
    created_by_name?: string;
    completed_by_name?: string | null;
    completed_at?: Timestamp | null;
    police_involved?: boolean;
    police_case_number?: string;
    fault?: 'own' | 'third_party' | 'unknown';
    third_party?: any;
    accident_sketch_data?: any[];
    accident_sketch_image?: string;
    created_via?: string;
}

export interface Contract {
  id: string;
  vehicleId: string | null;
  contractType: string;
  providerName: string | null;
  contractNumber?: string;
  startDate?: Timestamp | null;
  endDate: Timestamp | null;
  cancellationDeadline: Timestamp | null;
  contractStatus: 'active' | 'expiring_soon' | 'expired';
  monthlyCostEur?: number;
  yearlyCostEur?: number;
  oneTimeCostEur?: number;
  responsibleName?: string;
  notes?: string;
  summary?: string;
  extracted?: any;
  documentRef?: any;
  matchStatus: 'unverified' | 'verified' | 'corrected';
}

export interface Handover {
  id: string;
  vehicleId: string;
  vehicleLabel: string;
  fromDriverId: string | null;
  fromDriverName: string | null;
  toDriverId: string;
  toDriverName: string;
  handoverAt: Timestamp;
  status: 'draft' | 'completed' | 'new_damage' | 'in_review' | 'closed';
  odometerKm?: number;
  existingDamageConfirmed?: boolean;
  notes?: string;
  checklistEnabled?: boolean;
  checklist?: any[];
  requiredPhotos?: any;
  additionalPhotos?: any[];
  statusNotes?: string;
}

export interface ProcessedReminder {
  id: string;
  kind: string;
  due_date: Timestamp;
  vehicleId?: string;
  driverId?: string;
  bezug: string;
  fahrzeugMarkeModell: string;
  dueDate: Date;
  daysLeft: number;
  urgency: 'overdue' | 'high' | 'medium' | 'low';
  urgencyText: string;
  urgencyColor: string;
  icon: React.ElementType;
  title: string;
}

export interface ProcessedContract {
  id: string;
  contractType: string;
  providerName: string | null;
  bezug: string;
  fahrzeugMarkeModell: string;
  dueDate: Date;
  daysLeft: number;
  urgency: 'overdue' | 'high' | 'medium' | 'low';
  urgencyText: string;
  urgencyColor: string;
  deadlineType: 'Kündigungsfrist' | 'Vertragsende';
}

export interface DashboardKPIs {
  openDamagesCount: number;
  totalVehiclesCount: number;
  openTasksCount: number;
  myOpenTasksCount: number;
  overdueTasksCount: number;
  totalDriversCount: number;
  openRemindersCount: number;
  overdueRemindersCount: number;
  upcomingContractsCount: number;
}

export interface IncidentTrendData {
  month: string;
  damages: number;
  accidents: number;
}

interface DashboardDataContextType {
  vehicles: WithId<Vehicle>[];
  drivers: WithId<Driver>[];
  tasks: WithId<Task>[];
  events: WithId<VehicleEvent>[];
  handovers: WithId<Handover>[];
  contracts: WithId<Contract>[];
  reminders: ProcessedReminder[];
  upcomingContracts: ProcessedContract[];
  
  kpis: DashboardKPIs;
  monthlyCosts: { maintenance: number; damages: number; leasing: number; financing: number; };
  incidentTrend: IncidentTrendData[];
  isLoading: boolean;
}

const DashboardDataContext = createContext<DashboardDataContextType | undefined>(undefined);

const parseToDate = (ts: any): Date | null => {
    if (!ts) return null;
    if (ts instanceof Timestamp) return ts.toDate();
    if (ts?.seconds !== undefined) return new Timestamp(ts.seconds, ts.nanoseconds || 0).toDate();
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
};

export const DashboardDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const firestore = useFirestore();
  const { session } = useSession();
  const [canLoadWatchers, setCanLoadWatchers] = useState(false);

  useEffect(() => {
    if (firestore) {
        const timer = setTimeout(() => setCanLoadWatchers(true), 150);
        return () => clearTimeout(timer);
    }
  }, [firestore]);

  const isReady = !!firestore && canLoadWatchers;

  const vQ = useMemoFirebase(() => isReady ? query(collection(firestore!, 'vehicles'), orderBy('license_plate')) : null, [isReady, firestore]);
  const dQ = useMemoFirebase(() => isReady ? query(collection(firestore!, 'drivers'), orderBy('last_name'))  : null, [isReady, firestore]);
  const tQ = useMemoFirebase(() => isReady ? query(collection(firestore!, 'tasks'), orderBy('due_date', 'asc'), limit(500)) : null, [isReady, firestore]);
  const eQ = useMemoFirebase(() => isReady ? query(collection(firestore!, 'vehicle_events'), orderBy('due_date', 'desc'), limit(500)) : null, [isReady, firestore]);
  const rQ = useMemoFirebase(() => isReady ? query(collection(firestore!, 'reminders'), limit(500)) : null, [isReady, firestore]);
  const cQ = useMemoFirebase(() => isReady ? query(collection(firestore!, 'contracts'), orderBy('endDate', 'asc')) : null, [isReady, firestore]);
  const hQ = useMemoFirebase(() => isReady ? query(collection(firestore!, 'vehicle_handovers'), orderBy('handoverAt', 'desc'), limit(300)) : null, [isReady, firestore]);

  const { data: vData, isLoading: vL } = useCollection<Vehicle>(vQ);
  const { data: dData, isLoading: dL } = useCollection<Driver>(dQ);
  const { data: tData, isLoading: tL } = useCollection<Task>(tQ);
  const { data: eData, isLoading: eL } = useCollection<VehicleEvent>(eQ);
  const { data: rData, isLoading: rL } = useCollection<any>(rQ);
  const { data: cData, isLoading: cL } = useCollection<Contract>(cQ);
  const { data: hData, isLoading: hL } = useCollection<Handover>(hQ);

  const isLoading = !canLoadWatchers || vL || dL || tL || eL || rL || cL || hL;

  const value = useMemo(() => {
    const vehicles = vData || [];
    const drivers = dData || [];
    const tasks = tData || [];
    const events = eData || [];
    const handovers = hData || [];
    const rawReminders = (rData || []).filter(r => r.status === 'open');
    const contracts = cData || [];

    const now = startOfDay(new Date());
    const vMap = new Map(vehicles.map(v => [v.id, v]));
    const dMap = new Map(drivers.map(d => [d.id, d]));

    const combinedRemindersRaw: any[] = [];
    const seenSourceIds = new Set<string>();

    rawReminders.forEach(r => {
        combinedRemindersRaw.push(r);
        if (r.sourceEventId) seenSourceIds.add(r.sourceEventId);
    });

    const eventReminderTypes = ['inspection', 'repair', 'tuv', 'au', 'uvv', 'tire_change', 'service', 'other', 'damage', 'verkehrsunfall'];
    events.filter(e => e.status !== 'done' && eventReminderTypes.includes(e.type)).forEach(e => {
        if (!seenSourceIds.has(e.id)) {
            combinedRemindersRaw.push({
                id: e.id,
                kind: e.type,
                due_date: e.due_date,
                title: e.title,
                vehicleId: e.vehicleId,
                driverId: e.driverId,
            });
            seenSourceIds.add(e.id);
        }
    });

    contracts.filter(c => c.contractStatus !== 'expired').forEach(c => {
        if (c.cancellationDeadline) {
            combinedRemindersRaw.push({ id: `${c.id}-deadline`, kind: 'contract_deadline', due_date: c.cancellationDeadline, title: `Kündigungsfrist: ${c.providerName || 'Unbekannt'}`, vehicleId: c.vehicleId });
        }
        if (c.endDate) {
            combinedRemindersRaw.push({ id: `${c.id}-end`, kind: 'contract_end', due_date: c.endDate, title: `Vertragsende: ${c.providerName || 'Unbekannt'}`, vehicleId: c.vehicleId });
        }
    });

    const processedReminders: ProcessedReminder[] = combinedRemindersRaw.map(rem => {
      const d = parseToDate(rem.due_date);
      const dueDate = startOfDay(d || new Date());
      const daysLeft = differenceInCalendarDays(dueDate, now);
      const v = rem.vehicleId ? vMap.get(rem.vehicleId) : undefined;
      const dr = rem.driverId ? dMap.get(rem.driverId) : undefined;

      let urgency: ProcessedReminder['urgency'] = 'low';
      if (daysLeft < 0) urgency = 'overdue';
      else if (daysLeft <= 7) urgency = 'high';
      else if (daysLeft <= 30) urgency = 'medium';

      const absDays = Math.abs(daysLeft);
      const tagText = absDays === 1 ? 'Tag' : 'Tagen';

      return {
        ...rem,
        bezug: v?.license_plate ?? (dr ? `${dr.first_name} ${dr.last_name}` : 'Allgemein'),
        fahrzeugMarkeModell: v ? `${v.make} ${v.model}` : 'Nicht zugeordnet',
        dueDate,
        daysLeft,
        urgency,
        urgencyText: daysLeft < 0 
          ? `Seit ${absDays} ${tagText} überfällig` 
          : (daysLeft === 0 ? 'Heute fällig' : `In ${daysLeft} ${tagText}`),
        urgencyColor: daysLeft < 0 ? 'text-red-500' : (daysLeft <= 7 ? 'text-orange-500' : 'text-muted-foreground'),
        icon: (kindIcons as any)[rem.kind || ''] || kindIcons.other,
        title: rem.title || reminderKindTranslations[rem.kind] || rem.kind || 'Termin',
      };
    }).sort((a, b) => a.daysLeft - b.daysLeft);

    const upcomingContracts: ProcessedContract[] = contracts
      .filter(c => c.contractStatus !== 'expired')
      .map(c => {
        const relevantDate = c.cancellationDeadline || c.endDate;
        const d = parseToDate(relevantDate);
        const dueDate = startOfDay(d || new Date());
        const daysLeft = differenceInCalendarDays(dueDate, now);
        const v = c.vehicleId ? vMap.get(c.vehicleId) : undefined;

        let urgency: ProcessedContract['urgency'] = 'low';
        if (daysLeft < 0) urgency = 'overdue';
        else if (daysLeft <= 14) urgency = 'high';
        else if (daysLeft <= 45) urgency = 'medium';

        const absDays = Math.abs(daysLeft);
        const tagText = absDays === 1 ? 'Tag' : 'Tagen';

        return {
          id: c.id,
          contractType: c.contractType,
          providerName: c.providerName,
          bezug: v?.license_plate ?? 'Nicht zugeordnet',
          fahrzeugMarkeModell: v ? `${v.make} ${v.model}` : 'Kein Fahrzeug',
          dueDate,
          daysLeft,
          urgency,
          urgencyText: daysLeft < 0 
            ? `Seit ${absDays} ${tagText} überfällig` 
            : (daysLeft === 0 ? 'Heute fällig' : `In ${daysLeft} ${tagText}`),
          urgencyColor: daysLeft < 0 ? 'text-red-500' : 'text-muted-foreground',
          deadlineType: c.cancellationDeadline ? 'Kündigungsfrist' : 'Vertragsende',
        };
      }).sort((a, b) => a.daysLeft - b.daysLeft);

    const kpis: DashboardKPIs = {
      openDamagesCount: events.filter(e => ['damage', 'verkehrsunfall'].includes(e.type) && e.status !== 'done').length,
      totalVehiclesCount: vehicles.length,
      openTasksCount: tasks.filter(t => t.status !== 'done').length,
      myOpenTasksCount: tasks.filter(t => t.status !== 'done' && t.assignee_name === session?.name).length,
      overdueTasksCount: tasks.filter(t => {
          const d = parseToDate(t.due_date);
          return t.status !== 'done' && d && d < now;
      }).length,
      totalDriversCount: drivers.length,
      openRemindersCount: processedReminders.length,
      overdueRemindersCount: processedReminders.filter(r => r.urgency === 'overdue').length,
      upcomingContractsCount: upcomingContracts.filter(c => c.daysLeft >= 0 && c.daysLeft <= 30).length,
    };

    const monthsToCalculate = [subMonths(new Date(), 2), subMonths(new Date(), 1), new Date()];
    const incidentTrend: IncidentTrendData[] = monthsToCalculate.map(monthDate => {
        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);
        const monthLabel = format(monthDate, 'MMMM', { locale: de });
        const damagesCount = events.filter(e => {
            const d = parseToDate(e.due_date);
            return e.type === 'damage' && d && isWithinInterval(d, { start, end });
        }).length;
        const accidentsCount = events.filter(e => {
            const d = parseToDate(e.due_date);
            return e.type === 'verkehrsunfall' && d && isWithinInterval(d, { start, end });
        }).length;
        return { month: monthLabel, damages: damagesCount, accidents: accidentsCount };
    });
    
    const currentMonthNum = new Date().getMonth();
    const currentYearNum = new Date().getFullYear();
    const monthlyCosts = events.reduce((acc, e) => {
      const d = parseToDate(e.due_date);
      if (d && d.getMonth() === currentMonthNum && d.getFullYear() === currentYearNum) {
        if (['damage', 'verkehrsunfall'].includes(e.type)) acc.damages += e.cost_eur || 0;
        else acc.maintenance += e.cost_eur || 0;
      }
      return acc;
    }, { maintenance: 0, damages: 0, leasing: 0, financing: 0 });

    vehicles.forEach(v => {
      if (v.status !== 'inaktiv') {
        monthlyCosts.leasing += v.leasing_rate_eur || 0;
        monthlyCosts.financing += v.financing_rate_eur || 0;
      }
    });

    return {
      vehicles, drivers, tasks, events, handovers, reminders: processedReminders, contracts,
      kpis, monthlyCosts, upcomingContracts,
      incidentTrend,
      isLoading
    };
  }, [vData, dData, tData, eData, rData, cData, hData, isLoading, session?.name]);

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
};

export const useDashboardData = () => {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error('useDashboardData must be used within a DashboardDataProvider');
  return ctx;
};