'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Timestamp } from 'firebase/firestore';

// Define the state shape
export type ChecklistItem = {
  key: string;
  label: string;
  state: 'ok' | 'missing' | 'defect';
  note?: string;
};

export type PhotoData = {
  status: 'missing' | 'added' | 'skipped';
  url: string | null;
  metadataText: string | null;
  placeholderNote: string | null;
};

export interface HandoverData {
  vehicleId: string | null;
  vehicleLabel: string | null;
  fromDriverId: string | null;
  fromDriverName: string | null;
  toDriverId: string | null;
  toDriverName: string | null;
  handoverAt: Timestamp;
  odometerKm: number | null;
  existingDamageConfirmed: boolean;
  notes: string | null;
  checklistEnabled: boolean;
  checklist: ChecklistItem[];
  requiredPhotos: {
    front: PhotoData;
    rear: PhotoData;
    left: PhotoData;
    right: PhotoData;
    mirror_left: PhotoData;
    mirror_right: PhotoData;
  };
  additionalPhotos: { url: string; metadataText: string; }[];
  status: 'draft' | 'completed' | 'new_damage' | 'in_review' | 'closed';
  statusNotes: string | null;
  newDamageEventId: string | null;
}

// Define the context type
interface HandoverContextType {
  handoverData: HandoverData;
  setHandoverData: React.Dispatch<React.SetStateAction<HandoverData>>;
  resetHandoverData: () => void;
}

// Default checklist items
export const defaultChecklist: ChecklistItem[] = [
    { key: 'vehicle_folder', label: 'Fahrzeugmappe vorhanden', state: 'ok' },
    { key: 'registration_copy', label: 'Fahrzeugschein Kopie vorhanden', state: 'ok' },
    { key: 'first_aid_kit', label: 'Erste-Hilfe-Set vorhanden', state: 'ok' },
    { key: 'warning_triangle', label: 'Warndreieck vorhanden', state: 'ok' },
    { key: 'transport_net', label: 'Transportnetz vorhanden', state: 'ok' },
    { key: 'dolly', label: 'Sackkarre vorhanden', state: 'ok' },
    { key: 'scanner_mount', label: 'Scannerhalterung vorhanden', state: 'ok' },
    { key: 'samsara', label: 'Samsara verbunden/aktiv', state: 'ok' },
];

// Initial state
const getInitialState = (): HandoverData => ({
  vehicleId: null,
  vehicleLabel: null,
  fromDriverId: null,
  fromDriverName: null,
  toDriverId: null,
  toDriverName: null,
  handoverAt: Timestamp.now(),
  odometerKm: null,
  existingDamageConfirmed: false,
  notes: null,
  checklistEnabled: false,
  checklist: JSON.parse(JSON.stringify(defaultChecklist)),
  requiredPhotos: {
    front: { status: 'missing', url: null, metadataText: null, placeholderNote: null },
    rear: { status: 'missing', url: null, metadataText: null, placeholderNote: null },
    left: { status: 'missing', url: null, metadataText: null, placeholderNote: null },
    right: { status: 'missing', url: null, metadataText: null, placeholderNote: null },
    mirror_left: { status: 'missing', url: null, metadataText: null, placeholderNote: null },
    mirror_right: { status: 'missing', url: null, metadataText: null, placeholderNote: null },
  },
  additionalPhotos: [],
  status: 'draft',
  statusNotes: null,
  newDamageEventId: null,
});

// Create the context
const HandoverStateContext = createContext<HandoverContextType | undefined>(undefined);

// Create the provider component
export const HandoverStateProvider = ({ children }: { children: ReactNode }) => {
  const [handoverData, setHandoverData] = useState<HandoverData>(getInitialState());
  
  const resetHandoverData = () => {
    setHandoverData(getInitialState());
  }

  return (
    <HandoverStateContext.Provider value={{ handoverData, setHandoverData, resetHandoverData }}>
      {children}
    </HandoverStateContext.Provider>
  );
};

// Custom hook to use the context
export const useHandoverState = () => {
  const context = useContext(HandoverStateContext);
  if (context === undefined) {
    throw new Error('useHandoverState must be used within a HandoverStateProvider');
  }
  return context;
};

    