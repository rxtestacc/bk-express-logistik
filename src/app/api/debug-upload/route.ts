import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Serverseitige Upload-Route, die garantiert eine isolierte Admin-Instanz
 * mit Service-Account-Credentials verwendet. Dies umgeht Probleme mit fehlerhaften
 * Metadata-Servern in Cloud-Umgebungen.
 */

const DEBUG_APP_NAME = 'debug-upload-app';

function getDebugAdminApp() {
  // Suche gezielt nach unserer benannten App, um Wiederverwendung von ADC-Apps zu verhindern
  const existingApp = admin.apps.find(app => app?.name === DEBUG_APP_NAME);
  if (existingApp) {
    return existingApp;
  }

  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountVar) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY fehlt. Initialisierung abgebrochen.'
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(serviceAccountVar);
  } catch (err) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY ist kein gültiges JSON.');
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error('Service-Account-JSON ist unvollständig.');
  }

  console.log(`[API-DEBUG-UPLOAD] Initialisiere isolierte Admin-App: ${DEBUG_APP_NAME}`);

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    }),
    storageBucket: firebaseConfig.storageBucket,
  }, DEBUG_APP_NAME);
}

export async function POST(request: Request) {
  try {
    const debugApp = getDebugAdminApp();
    
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Keine Datei im Request.' }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `debug-server/${timestamp}_${safeFileName}`;

    console.log(`[API-DEBUG-UPLOAD] Starte Upload mit isolierter App: ${file.name}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Nutze explizit die isolierte App für den Storage-Zugriff
    const bucket = admin.storage(debugApp).bucket(firebaseConfig.storageBucket);
    const blob = bucket.file(storagePath);

    await blob.save(buffer, {
      metadata: {
        contentType: file.type || 'application/octet-stream',
      },
      resumable: false,
    });

    // Erzeuge eine signierte URL für den Client-Erfolg
    const [signedUrl] = await blob.getSignedUrl({
      action: 'read',
      expires: '2100-01-01',
    });

    return NextResponse.json({
      success: true,
      message: 'Server-Upload via isolierter Admin-App erfolgreich.',
      path: storagePath,
      downloadUrl: signedUrl,
      appName: debugApp.name
    });

  } catch (error: any) {
    console.error('[API-DEBUG-UPLOAD] Kritischer Fehler:', error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Serverfehler beim isolierten Upload.',
        code: error?.code ?? null,
        raw: {
          message: error?.message,
          stack: error?.stack?.split('\n').slice(0, 5),
          hint: 'Wenn hier weiterhin gcp-metadata erscheint, schlägt die Credential-Zuweisung fehl.'
        },
      },
      { status: 500 }
    );
  }
}
