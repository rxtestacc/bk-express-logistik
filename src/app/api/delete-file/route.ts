import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview API-Endpunkt zum sicheren Löschen von Dateien aus Firebase Storage.
 * Umgeht Browser-Proxy-Blockaden durch Verwendung des Admin SDKs.
 */

const UPLOAD_APP_NAME = 'server-upload-app';

function getAdminApp() {
  const existingApp = admin.apps.find(app => app?.name === UPLOAD_APP_NAME);
  if (existingApp) {
    return existingApp;
  }

  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountVar) {
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountVar);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: firebaseConfig.storageBucket,
    }, UPLOAD_APP_NAME);
  } catch (err) {
    console.error('[API-DELETE] Initialisierungsfehler:', err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { path } = await request.json();

    if (!path) {
      return NextResponse.json({ success: false, error: 'Pfad fehlt.' }, { status: 400 });
    }

    const app = getAdminApp();
    if (!app) {
      return NextResponse.json({ success: false, error: 'Server-Konfiguration fehlerhaft.' }, { status: 500 });
    }

    console.log(`[API-DELETE] Lösche Datei: ${path}`);
    
    const bucket = admin.storage(app).bucket();
    const file = bucket.file(path);

    // Prüfen ob Datei existiert, bevor wir löschen (verhindert unnötige Fehler)
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[API-DELETE] Kritischer Fehler:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Löschen fehlgeschlagen.'
    }, { status: 500 });
  }
}
