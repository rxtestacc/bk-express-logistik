'use client';
    
import { useState, useEffect, useRef } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; 
  isLoading: boolean;       
  error: FirestoreError | Error | null; 
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Stabilized against ca9/b815 errors using delayed execution and strict cleanup.
 */
export function useDoc<T = any>(
  memoizedDocRef: (DocumentReference<DocumentData> & {__memo?: boolean}) | null | undefined,
): UseDocResult<T> {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!memoizedDocRef);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Cleanup previous listener immediately
    if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
    }

    setIsLoading(true);
    setError(null);

    // Small delay to allow Firestore state to stabilize (ca9 fix)
    const initTimer = setTimeout(() => {
        if (!isMounted) return;

        try {
            const unsub = onSnapshot(
              memoizedDocRef,
              (snapshot: DocumentSnapshot<DocumentData>) => {
                if (!isMounted) return;

                if (snapshot.exists()) {
                  setData({ ...(snapshot.data({ serverTimestamps: 'estimate' }) as T), id: snapshot.id });
                } else {
                  setData(null);
                }
                setError(null);
                setIsLoading(false);
              },
              (err: FirestoreError) => {
                if (!isMounted) return;

                const contextualError = new FirestorePermissionError({
                  operation: 'get',
                  path: memoizedDocRef.path,
                });

                setError(contextualError);
                setData(null);
                setIsLoading(false);
                errorEmitter.emit('permission-error', contextualError);
              }
            );
            unsubscribeRef.current = unsub;
        } catch (e) {
            console.warn("Failed to initialize doc snapshot safely", e);
            setIsLoading(false);
        }
    }, 20);

    return () => {
        isMounted = false;
        clearTimeout(initTimer);
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }
    };
  }, [memoizedDocRef]);

  if(memoizedDocRef && !memoizedDocRef.__memo) {
    throw new Error('Firestore DocumentReference was not properly memoized using useMemoFirebase.');
  }

  return { data, isLoading, error };
}
