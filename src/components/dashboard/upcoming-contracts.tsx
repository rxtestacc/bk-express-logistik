'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { FileText, Eye, ArrowUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { useDashboardData, ProcessedContract } from './dashboard-data-provider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '../ui/button';

const contractTypeTranslations: { [key: string]: string } = {
    leasing: 'Leasing',
    financing: 'Finanzierung',
    purchase: 'Kauf',
    warranty: 'Garantie',
    maintenance: 'Wartung',
    insurance: 'Versicherung',
    other: 'Sonstiges',
};

const UrgencyBadge = ({ contract }: { contract: ProcessedContract }) => {
    let variant: 'destructive' | 'secondary' | 'default' = 'default';
    let text = contract.urgencyText;
    let className = 'bg-yellow-500 hover:bg-yellow-500/80 text-black'; // Medium

    if (contract.urgency === 'overdue') {
        variant = 'destructive';
        className = '';
    } else if (contract.urgency === 'high') {
       className = 'bg-orange-500 hover:bg-orange-500/80 text-white';
    }

    return <Badge variant={variant} className={cn(className, 'whitespace-nowrap')}>{text}</Badge>;
}

export function UpcomingContracts() {
  const { upcomingContracts, isLoading } = useDashboardData();
  const router = useRouter();

  const contractsToShow = useMemo(() => {
    if (!upcomingContracts) return [];
    return upcomingContracts.slice(0, 5);
  }, [upcomingContracts]);


  const handleNavigate = (contractId: string) => {
    router.push(`/vertraege/${contractId}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nächste 5 Vertragsfristen</CardTitle>
        <CardDescription>Eine Übersicht der nächsten 5 auslaufenden Verträge und Kündigungsfristen.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : contractsToShow.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-48">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">Keine Verträge gefunden</p>
            <p className="text-sm text-muted-foreground">Es sind keine Verträge im System hinterlegt.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Vertragsart</TableHead>
                    <TableHead>Bezug</TableHead>
                    <TableHead>Anbieter</TableHead>
                    <TableHead>Fälligkeit</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {contractsToShow.map((contract) => (
                    <TableRow key={contract.id}>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">{contractTypeTranslations[contract.contractType] || contract.contractType}</p>
                                    <p className="text-xs text-muted-foreground">{contract.deadlineType}</p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>
                            <p className="font-medium">{contract.bezug}</p>
                            <p className="text-xs text-muted-foreground">{contract.fahrzeugMarkeModell}</p>
                        </TableCell>
                         <TableCell className="text-muted-foreground">{contract.providerName}</TableCell>
                        <TableCell>
                            <div className='flex flex-col gap-1'>
                                <UrgencyBadge contract={contract} />
                                <span className='text-xs text-muted-foreground'>
                                    am {format(contract.dueDate, 'dd.MM.yyyy', { locale: de })}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                             <Button variant="ghost" size="sm" onClick={() => handleNavigate(contract.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Details
                             </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
