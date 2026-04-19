'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInAnonymously } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

/**
 * Global cache for Firebase instances using a robust singleton pattern.
 * This prevents multiple initializations during Turbopack HMR.
 */
const GLOBAL_SYMBOL = Symbol.for('bkexpress.firebase.cache');

interface FirebaseCache {
  app?: FirebaseApp;
  firestore?: Firestore;
  auth?: Auth;
  storage?: FirebaseStorage;
}

function getCache(): FirebaseCache {
  if (typeof window === 'undefined') return {};
  const g = globalThis as any;
  if (!g[GLOBAL_SYMBOL]) {
    g[GLOBAL_SYMBOL] = {};
  }
  return g[GLOBAL_SYMBOL];
}

const cache = getCache();

if (typeof window !== 'undefined' && !cache.app) {
  cache.app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  cache.firestore = getFirestore(cache.app);
  cache.auth = getAuth(cache.app);
  cache.storage = getStorage(cache.app);

  // ZIEL: Firebase Auth anonym aktivieren, um Storage-Uploads zu ermöglichen
  signInAnonymously(cache.auth)
    .then(() => {
      console.log("Firebase Auth: Anonym angemeldet (UID: " + cache.auth?.currentUser?.uid + ")");
    })
    .catch((error) => {
      console.error("Anonymous Auth Error:", error);
    });
}

export const firebaseServices = {
  get firebaseApp() { return cache.app!; },
  get firestore() { return cache.firestore!; },
  get auth() { return cache.auth!; },
  get storage() { return cache.storage!; },
};

export function initializeFirebase() {
  return firebaseServices;
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
