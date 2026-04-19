
'use client';

import { MasterListTable } from '@/components/vehicles/master-list-table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LayoutList } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MasterListePage() {
    const router = useRouter();

    return (
        <div className="space-y-6 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => router.back()} 
                        className="mb-2 -ml-2 text-muted-foreground hover:text-primary"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Zurück zu Fahrzeugen
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <LayoutList className="h-8 w-8 text-primary" />
                        Master Liste
                    </h1>
                    <p className="text-muted-foreground">
                        Zentrale Übersicht aller Fahrzeug- und Vertragsdaten.
                    </p>
                </div>
            </div>

            <MasterListTable />
        </div>
    );
}
