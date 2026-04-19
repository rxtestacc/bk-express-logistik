'use client';

import { useState } from 'react';
import { PlusCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ContractList } from '@/components/contracts/contract-list';
import { ContractListToolbar } from '@/components/contracts/contract-list-toolbar';
import type { DateRange } from '@/components/contracts/contract-list-toolbar';
import { ContractAIAssistant } from '@/components/contracts/contract-ai-assistant';
import { ContractFormSheet } from '@/components/contracts/contract-form-sheet';
import type { Contract } from '@/lib/types';

export default function VertraegePage() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [vehicleId, setVehicleId] = useState<string>('');
  const [contractType, setContractType] = useState<string>('');
  const [providerName, setProviderName] = useState<string>('');
  const [contractStatus, setContractStatus] = useState<string>('');
  const [matchStatus, setMatchStatus] = useState<string>('');
  
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | undefined>(undefined);


  const handleEditContract = (contract: Contract) => {
    setEditingContract(contract);
    setIsEditSheetOpen(true);
  };

  const handleSheetOpenChange = (isOpen: boolean) => {
    setIsEditSheetOpen(isOpen);
    if (!isOpen) {
      setEditingContract(undefined);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold md:text-3xl">Vertragsübersicht</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsAssistantOpen(true)}
              className="border-primary/40 hover:border-primary text-primary bg-primary/5 shadow-sm"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              KI-Assistent fragen
            </Button>
            <Button onClick={() => router.push('/vertraege/neu')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Vertrag hinzufügen
            </Button>
          </div>
        </div>
        <ContractListToolbar 
          dateRange={dateRange}
          setDateRange={setDateRange}
          vehicleId={vehicleId}
          setVehicleId={setVehicleId}
          contractType={contractType}
          setContractType={setContractType}
          providerName={providerName}
          setProviderName={setProviderName}
          contractStatus={contractStatus}
          setContractStatus={setContractStatus}
          matchStatus={matchStatus}
          setMatchStatus={setMatchStatus}
        />
        <ContractList 
          dateRange={dateRange}
          vehicleId={vehicleId}
          contractType={contractType}
          providerName={providerName}
          contractStatus={contractStatus}
          matchStatus={matchStatus}
          onEditContract={handleEditContract}
        />
      </div>

      <ContractAIAssistant 
        isOpen={isAssistantOpen} 
        onOpenChange={setIsAssistantOpen} 
      />

      <ContractFormSheet
        isOpen={isEditSheetOpen}
        onOpenChange={handleSheetOpenChange}
        contractData={editingContract as any}
      />
    </>
  );
}
