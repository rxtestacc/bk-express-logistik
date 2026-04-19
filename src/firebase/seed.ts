'use client';

import { useEffect } from 'react';
import { collection, writeBatch, doc, getDoc } from 'firebase/firestore';
import { useFirestore } from './provider';

const pinsToSeed = [
  { pin: '112233', name: 'Admin', role: 'Admin', active: true },
  { pin: '56789', name: 'Dispo', role: 'Dispo', active: true },
  { pin: '0800', name: 'Mechaniker/Fahrer', role: 'Mechaniker/Fahrer', active: true },
  { pin: 'bk987321bk', name: 'Bilal Karagün', role: 'Admin', active: true },
  { pin: 'ha484820ha', name: 'Haldun Alay', role: 'Admin', active: true },
  { pin: 'hy668241hy', name: 'Hayrettin Yildirim', role: 'Admin', active: true },
  { pin: 'mm005471mm', name: 'Murathan Memisoglu', role: 'Admin', active: true },
  { pin: 'ha652301ha', name: 'Haluk Alay', role: 'Admin', active: true },
  { pin: 'rs112233', name: 'Ramazan Sanli', role: 'Admin', active: true },
];

export function SeedPins() {
  const firestore = useFirestore();

  useEffect(() => {
    // Explizite Prüfung der Firestore-Instanz vor dem Seeding
    if (!firestore || typeof firestore.terminate !== 'function') return;

    const seed = async () => {
      try {
        const batch = writeBatch(firestore);
        let writesPending = false;

        for (const pinData of pinsToSeed) {
          const docRef = doc(firestore, 'pins', pinData.pin);
          const docSnap = await getDoc(docRef);
          
          if (!docSnap.exists()) {
            batch.set(docRef, pinData);
            writesPending = true;
          }
        }

        if (writesPending) {
          await batch.commit();
          console.log('[SEED] PINs successfully verified and seeded.');
        }
      } catch (e) {
        console.warn('[SEED] Silent skip during initialization phase:', e);
      }
    };

    seed();
  }, [firestore]);

  return null;
}
