'use client';

import { UnifiedDocumentGrid } from '@/components/documents/unified-document-grid';
import { FolderOpen, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { DocumentManager } from '@/components/documents/document-manager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function GlobalDocumentsPage() {
    const [isUploadOpen, setIsUploadOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <FolderOpen className="h-8 w-8 text-primary" />
                        Dokumenten-Archiv
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Zentrale Übersicht aller Fahrzeug- und Fahrerunterlagen sowie Schadensfotos.
                    </p>
                </div>
                <Button onClick={() => setIsUploadOpen(true)}>
                    <FileUp className="mr-2 h-4 w-4" />
                    Allgemeiner Upload
                </Button>
            </div>

            <UnifiedDocumentGrid showVehicleInfo={true} />

            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Neues Dokument hinzufügen</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <DocumentManager 
                            entityId="general" 
                            entityType="vehicle" 
                            onClose={() => setIsUploadOpen(false)}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
