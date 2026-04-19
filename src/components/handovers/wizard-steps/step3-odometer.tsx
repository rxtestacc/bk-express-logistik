'use client';

import { useHandoverState } from '../handover-state-provider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function HandoverStep3Odometer() {
  const { handoverData, setHandoverData } = useHandoverState();

  const handleOdometerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHandoverData(prev => ({
      ...prev,
      odometerKm: value === '' ? null : Number(value),
    }));
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h2 className="text-2xl font-semibold text-center">Kilometerstand eintragen</h2>
      <p className="text-center text-muted-foreground">
        Geben Sie den aktuellen Kilometerstand des Fahrzeugs ein. Dieser Wert ist wichtig für die Nachverfolgung.
      </p>
      
      <div className="space-y-2">
        <Label htmlFor="odometer">Aktueller Kilometerstand (km)</Label>
        <Input
          id="odometer"
          type="number"
          value={handoverData.odometerKm ?? ''}
          onChange={handleOdometerChange}
          placeholder="z.B. 12345"
          className="text-center text-lg"
        />
      </div>
    </div>
  );
}
