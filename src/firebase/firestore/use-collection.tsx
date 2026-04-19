'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionOptions<T> {
    onData?: (snapshot: QuerySnapshot<T>) => void;
    onError?: (error: FirestoreError | Error) => void;
}

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; 
  isLoading: boolean;       
  error: FirestoreError | Error | null; 
}

export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * React hook to subscribe to a Firestore collection in real-time.
 * Stabilized against ca9/b815 errors using delayed execution and strict cleanup.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
    options?: UseCollectionOptions<T>
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  const [data, setData] = useState<ResultItemType[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!memoizedTargetRefOrQuery);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!memoizedTargetRefOrQuery) {
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

    // Small delay to prevent snapshot thrashing during rapid re-renders (ca9 fix)
    const initTimer = setTimeout(() => {
        if (!isMounted) return;

        try {
            const unsub = onSnapshot(
              memoizedTargetRefOrQuery,
              (snapshot: QuerySnapshot<DocumentData>) => {
                if (!isMounted) return;

                if(options?.onData) {
                    options.onData(snapshot as QuerySnapshot<T>);
                } else {
                    const results: ResultItemType[] = [];
                    snapshot.docs.forEach((doc) => {
                      results.push({ ...(doc.data({ serverTimestamps: 'estimate' }) as T), id: doc.id });
                    });
                    setData(results);
                }
                setError(null);
                setIsLoading(false);
              },
              (err: FirestoreError) => {
                if (!isMounted) return;

                const path: string =
                  memoizedTargetRefOrQuery.type === 'collection'
                    ? (memoizedTargetRefOrQuery as CollectionReference).path
                    : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query?.path?.canonicalString() || 'unknown';

                const contextualError = new FirestorePermissionError({
                  operation: 'list',
                  path,
                });

                setError(contextualError);
                setData(null);
                setIsLoading(false);
                
                if (options?.onError) {
                    options.onError(contextualError);
                }

                errorEmitter.emit('permission-error', contextualError);
              }
            );
            unsubscribeRef.current = unsub;
        } catch (e) {
            console.warn("Failed to initialize snapshot safely", e);
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
  }, [memoizedTargetRefOrQuery]);
  
  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error('Firestore Query/Ref was not properly memoized using useMemoFirebase.');
  }
  return { data, isLoading, error };
}
