'use client';

import { useHandoverState, ChecklistItem } from '../handover-state-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function HandoverStep7Checklist() {
  const { handoverData, setHandoverData } = useHandoverState();

  const handleEnabledChange = (enabled: boolean) => {
    setHandoverData(prev => ({
      ...prev,
      checklistEnabled: enabled,
    }));
  };
  
  const handleItemStateChange = (key: string, state: ChecklistItem['state']) => {
      setHandoverData(prev => ({
          ...prev,
          checklist: prev.checklist.map(item => item.key === key ? { ...item, state } : item)
      }))
  };
  
  const handleItemNoteChange = (key: string, note: string) => {
      setHandoverData(prev => ({
          ...prev,
          checklist: prev.checklist.map(item => item.key === key ? { ...item, note } : item)
      }))
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Checkliste Fahrzeugausstattung</h2>
        <p className="text-muted-foreground">
          Überprüfen Sie die Vollständigkeit der Fahrzeugausstattung.
        </p>
      </div>

      <div className="flex items-center space-x-2 p-4 border rounded-md">
        <Switch
          id="checklist-enabled"
          checked={handoverData.checklistEnabled}
          onCheckedChange={handleEnabledChange}
        />
        <Label htmlFor="checklist-enabled" className="text-base">
          Checkliste für diese Übergabe aktivieren
        </Label>
      </div>

      {handoverData.checklistEnabled && (
        <Card className="animate-in fade-in">
          <CardContent className="p-4 space-y-6">
            {handoverData.checklist.map((item, index) => (
              <div key={item.key} className="space-y-3">
                <p className="font-medium">{index + 1}. {item.label}</p>
                <RadioGroup
                  value={item.state}
                  onValueChange={(value) => handleItemStateChange(item.key, value as ChecklistItem['state'])}
                  className="grid grid-cols-3 gap-2"
                >
                  <Label className={cn("flex items-center justify-center gap-2 rounded-md p-2 border cursor-pointer", item.state === 'ok' && "bg-green-100 dark:bg-green-900/30 border-green-400")}>
                    <RadioGroupItem value="ok" id={`${item.key}-ok`} /> OK
                  </Label>
                   <Label className={cn("flex items-center justify-center gap-2 rounded-md p-2 border cursor-pointer", item.state === 'missing' && "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400")}>
                    <RadioGroupItem value="missing" id={`${item.key}-missing`} /> Fehlt
                  </Label>
                   <Label className={cn("flex items-center justify-center gap-2 rounded-md p-2 border cursor-pointer", item.state === 'defect' && "bg-red-100 dark:bg-red-900/30 border-red-400")}>
                    <RadioGroupItem value="defect" id={`${item.key}-defect`} /> Defekt
                  </Label>
                </RadioGroup>
                {(item.state === 'missing' || item.state === 'defect') && (
                    <div className="animate-in fade-in">
                         <Input 
                            placeholder="Optionale Notiz..."
                            value={item.note || ''}
                            onChange={(e) => handleItemNoteChange(item.key, e.target.value)}
                         />
                    </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
