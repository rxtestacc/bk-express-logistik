'use client';

import { Car, Wrench, ShieldAlert, FileText, BadgeCheck, AlertTriangle, Users, ClipboardList, Calendar } from 'lucide-react';
import React from 'react';

export const reminderKindTranslations: { [key: string]: string } = {
  service: 'Service',
  hu: 'Hauptuntersuchung (TÜV)',
  au: 'Abgasuntersuchung',
  uvv: 'UVV-Prüfung',
  leasing_end: 'Leasing-Ende',
  warranty_end: 'Garantie-Ende',
  financing_end: 'Finanzierungs-Ende',
  tire_change: 'Reifenwechsel',
  inspection: 'Inspektion',
  tuv: 'TÜV (HU)',
  driver_license_expiry: 'Führerscheinablauf',
  other: 'Sonstiges',
  damage: 'Schaden',
  repair: 'Reparatur',
  verkehrsunfall: 'Verkehrsunfall',
  task: 'Aufgabe',
  contract_end: 'Vertragsende',
  contract_deadline: 'Kündigungsfrist',
};

export const reminderKindColors: { [key: string]: string } = {
  service: 'bg-blue-500',
  hu: 'bg-red-500',
  au: 'bg-red-500',
  uvv: 'bg-green-500',
  leasing_end: 'bg-purple-500',
  warranty_end: 'bg-indigo-500',
  financing_end: 'bg-pink-500',
  tire_change: 'bg-yellow-500',
  inspection: 'bg-teal-500',
  tuv: 'bg-red-500',
  driver_license_expiry: 'bg-sky-500',
  other: 'bg-gray-500',
  damage: 'bg-destructive',
  repair: 'bg-orange-500',
  verkehrsunfall: 'bg-destructive',
  task: 'bg-primary',
  contract_end: 'bg-slate-700',
  contract_deadline: 'bg-amber-600',
};

export const kindIcons: { [key: string]: React.ElementType } = {
  service: Wrench,
  hu: Car,
  au: Car,
  uvv: BadgeCheck,
  leasing_end: FileText,
  warranty_end: ShieldAlert,
  financing_end: FileText,
  tire_change: Wrench,
  inspection: Wrench,
  tuv: Car,
  driver_license_expiry: Users,
  other: AlertTriangle,
  damage: ShieldAlert,
  repair: Wrench,
  verkehrsunfall: ShieldAlert,
  task: ClipboardList,
  contract_end: FileText,
  contract_deadline: Calendar,
};
