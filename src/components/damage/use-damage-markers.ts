'use client';

import { useCallback, useState, useEffect } from 'react';
import { collection, query, where, addDoc, deleteDoc, doc, serverTimestamp, getDocs, limit, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';

export type DamageMarker = {
  id: string;
  vehicleId: string;
  eventId: string;
  xPct: number;
  yPct: number;
  status: 'open' | 'in_progress' | 'done';
  color?: string;
  note?: string;
  createdAt?: any;
  createdBy: string;
};

export type VehicleEventForMarker = {
    id: string;
    due_date: any;
    title: string;
}

const STATUS_COLORS: Record<DamageMarker['status'], string> = {
  open: '#EF4444',
  in_progress: '#F59E0B',
  done: '#10B981',
};

export function useDamageMarkers({ vehicleId, eventId }: { vehicleId: string; eventId: string; }) {
  const firestore = useFirestore();
  const [vehicleEvents, setVehicleEvents] = useState<VehicleEventForMarker[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Stabile Abfragen durch useMemoFirebase
  const cMQ = useMemoFirebase(() => 
    !firestore || !eventId ? null : query(collection(firestore, 'damage_markers'), where('eventId', '==', eventId)), 
    [firestore, eventId]
  );
  
  const vMQ = useMemoFirebase(() => 
    !firestore || !vehicleId ? null : query(collection(firestore, 'damage_markers'), where('vehicleId', '==', vehicleId), limit(200)), 
    [firestore, vehicleId]
  );

  const { data: currentMarkers, isLoading: loadingC } = useCollection<DamageMarker>(cMQ);
  const { data: vehicleMarkers, isLoading: loadingV } = useCollection<DamageMarker>(vMQ);

  useEffect(() => {
    if (!firestore || !vehicleMarkers || vehicleMarkers.length === 0) {
        setVehicleEvents([]);
        return;
    }
    
    const fetchEventDetails = async () => {
      setIsLoadingEvents(true);
      try {
        const uniqueEventIds = [...new Set(vehicleMarkers.map(m => m.eventId))].filter(Boolean);
        if (uniqueEventIds.length === 0) {
            setVehicleEvents([]);
            return;
        }

        // Firestore 'in' Abfragen sind auf 30 IDs begrenzt
        const ids = uniqueEventIds.slice(0, 30);
        const q = query(collection(firestore, 'vehicle_events'), where('__name__', 'in', ids));
        const snap = await getDocs(q);
        setVehicleEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      } catch (e) {
        console.error("Error fetching marker event details:", e);
      } finally {
        setIsLoadingEvents(false);
      }
    };
    fetchEventDetails();
  }, [firestore, vehicleMarkers]);

  const addMarker = useCallback(async (m: any, userName: string) => {
    if (!firestore) return;
    const ref = await addDoc(collection(firestore, 'damage_markers'), {
      ...m,
      color: STATUS_COLORS[m.status as DamageMarker['status']],
      createdAt: serverTimestamp(),
      createdBy: userName,
    });
    return ref;
  }, [firestore]);

  const removeMarker = useCallback(async (id: string, userName: string) => {
    if (!firestore) return;
    return deleteDoc(doc(firestore, 'damage_markers', id));
  }, [firestore]);

  return {
    firestore,
    currentMarkers,
    vehicleMarkers,
    vehicleEvents,
    isLoading: loadingC || loadingV || isLoadingEvents,
    addMarker,
    removeMarker,
  };
}