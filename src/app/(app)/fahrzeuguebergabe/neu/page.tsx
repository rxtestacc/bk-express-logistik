'use client';

import { HandoverWizard } from '@/components/handovers/handover-wizard';
import { Suspense } from 'react';

function NewHandoverPageContent() {
  return (
    <div>
        <div className="mb-6">
            <h1 className="text-3xl font-bold">Neue Fahrzeugübergabe</h1>
            <p className="text-muted-foreground">
                Führen Sie die folgenden Schritte durch, um eine Fahrzeugübergabe zu dokumentieren.
            </p>
        </div>
      <HandoverWizard />
    </div>
  );
}


export default function NewHandoverPage() {
    return (
        <Suspense fallback={<div>Lade...</div>}>
            <NewHandoverPageContent />
        </Suspense>
    )
}
