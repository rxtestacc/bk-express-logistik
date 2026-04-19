'use client';

import { useHandoverState } from '../handover-state-provider';
import VehicleDamageMap from '@/components/vehicles/vehicle-damage-map';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function HandoverStep4ExistingDamage() {
  const { handoverData, setHandoverData } = useHandoverState();

  if (!handoverData.vehicleId) {
    return (
      <div className="text-center text-muted-foreground">
        Bitte wählen Sie zuerst ein Fahrzeug aus.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Vorschäden prüfen und bestätigen</h2>
        <p className="text-muted-foreground">
          Überprüfen Sie die bekannten Schäden am Fahrzeug.
        </p>
      </div>

      <VehicleDamageMap vehicleId={handoverData.vehicleId} />

      <div className="space-y-4 pt-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="damage-confirmed"
            checked={handoverData.existingDamageConfirmed}
            onCheckedChange={(checked) =>
              setHandoverData((prev) => ({
                ...prev,
                existingDamageConfirmed: !!checked,
              }))
            }
          />
          <Label htmlFor="damage-confirmed" className="text-base font-medium">
            Vorschäden geprüft und bestätigt
          </Label>
        </div>
        
        {!handoverData.existingDamageConfirmed && (
            <div className="space-y-2 animate-in fade-in">
                <Label htmlFor="damage-notes">Kommentar zu Abweichungen (Pflichtfeld)</Label>
                <Textarea 
                    id="damage-notes"
                    placeholder="Beschreiben Sie hier, welche Abweichungen Sie festgestellt haben..."
                    value={handoverData.notes || ''}
                    onChange={(e) => setHandoverData(prev => ({ ...prev, notes: e.target.value }))}
                />
            </div>
        )}
      </div>
    </div>
  );
}
