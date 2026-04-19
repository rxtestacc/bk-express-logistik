'use client';

import React, { type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { firebaseServices } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * A simplified client-side provider that uses the pre-initialized 
 * singleton services from the firebase barrel file.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
