'use client';

import { useState, useMemo } from 'react';
import { useHandoverState } from '../handover-state-provider';
import DamageMap from '@/components/damage/damage-map';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function HandoverStep5NewDamage() {
  const { handoverData, setHandoverData } = useHandoverState();
  const [hasNewDamage, setHasNewDamage] = useState<'yes' | 'no' | null>(null);

  const tempEventId = useMemo(() => `handover_session_${handoverData.handoverAt.toMillis()}`, [handoverData.handoverAt]);

  const handleSelectionChange = (value: 'yes' | 'no') => {
    setHasNewDamage(value);
    if (value === 'yes') {
      // Store the temp ID so we can find the markers later
      setHandoverData(prev => ({ ...prev, newDamageEventId: tempEventId }));
    } else {
      // Clear it if user toggles back to "no"
      setHandoverData(prev => ({ ...prev, newDamageEventId: null }));
    }
  };

  if (!handoverData.vehicleId) {
    return (
      <div className="text-center text-muted-foreground">
        Bitte wählen Sie zuerst ein Fahrzeug aus.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Neue Schäden erfassen</h2>
        <p className="text-muted-foreground">
          Wurden neue, bisher nicht erfasste Schäden am Fahrzeug festgestellt?
        </p>
      </div>
      
      <RadioGroup
        value={hasNewDamage ?? ''}
        onValueChange={(value) => handleSelectionChange(value as 'yes' | 'no')}
        className="grid grid-cols-2 gap-4"
      >
        <Label className={cn("flex flex-col items-center justify-center rounded-md border-2 p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground", hasNewDamage === 'no' && 'border-primary bg-primary/10')}>
          <RadioGroupItem value="no" id="damage-no" className="sr-only" />
          <span className="text-lg font-semibold">Nein</span>
          <span className="text-sm text-muted-foreground text-center">Keine neuen Schäden vorhanden.</span>
        </Label>
        <Label className={cn("flex flex-col items-center justify-center rounded-md border-2 p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground", hasNewDamage === 'yes' && 'border-primary bg-primary/10')}>
          <RadioGroupItem value="yes" id="damage-yes" className="sr-only" />
           <span className="text-lg font-semibold">Ja</span>
          <span className="text-sm text-muted-foreground text-center">Es gibt neue Schäden zu erfassen.</span>
        </Label>
      </RadioGroup>

      {hasNewDamage === 'yes' && (
        <div className="space-y-4 pt-4 animate-in fade-in">
           <p className="text-center text-muted-foreground">
            Markieren Sie hier die neuen Schäden, die bei der Übergabe festgestellt wurden.
          </p>
          <DamageMap 
            vehicleId={handoverData.vehicleId} 
            eventId={tempEventId} 
            canEdit 
          />
        </div>
      )}
    </div>
  );
}
