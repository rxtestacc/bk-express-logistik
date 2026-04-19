import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Zentraler API-Endpunkt für serverseitige Dateiuploads.
 * Umgeht Browser-Proxy-Blockaden durch Verwendung des Admin SDKs mit Service Account.
 */

const UPLOAD_APP_NAME = 'server-upload-app';

function getAdminApp() {
  // Suche nach existierender Instanz
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
    console.error('[API-UPLOAD] Initialisierungsfehler:', err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const storagePath = formData.get('path') as string | null;

    if (!file || !storagePath) {
      return NextResponse.json({ 
        success: false, 
        error: 'Datei oder Zielpfad fehlt im Request.' 
      }, { status: 400 });
    }

    const app = getAdminApp();
    if (!app) {
      return NextResponse.json({ 
        success: false, 
        error: 'Server-Konfiguration fehlerhaft (FIREBASE_SERVICE_ACCOUNT_KEY fehlt oder ungültig).' 
      }, { status: 500 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Zugriff auf den Bucket via Admin SDK
    const bucket = admin.storage(app).bucket();
    const blob = bucket.file(storagePath);

    console.log(`[API-UPLOAD] Starte Server-Upload: ${storagePath} (${file.size} Bytes)`);

    await blob.save(buffer, {
      metadata: {
        contentType: file.type || 'application/octet-stream',
      },
      resumable: false, // Für API-Proxy-Uploads ist false stabiler
    });

    // Signierte URL generieren, die dauerhaft (bzw. sehr lange) gültig ist
    const [signedUrl] = await blob.getSignedUrl({
      action: 'read',
      expires: '2100-01-01',
    });

    return NextResponse.json({
      success: true,
      downloadUrl: signedUrl,
      path: storagePath,
      fileName: file.name
    });

  } catch (error: any) {
    console.error('[API-UPLOAD] Kritischer Fehler:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Ein unbekannter Serverfehler ist beim Upload aufgetreten.'
    }, { status: 500 });
  }
}
