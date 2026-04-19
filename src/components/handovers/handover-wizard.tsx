'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useHandoverState, HandoverStateProvider } from './handover-state-provider';
import { HandoverStep1Vehicle } from './wizard-steps/step1-vehicle';
import { HandoverStep2Drivers } from './wizard-steps/step2-drivers';
import { HandoverStep3Odometer } from './wizard-steps/step3-odometer';
import { HandoverStep4ExistingDamage } from './wizard-steps/step4-existing-damage';
import { HandoverStep5NewDamage } from './wizard-steps/step5-new-damage';
import { HandoverStepPhoto } from './wizard-steps/step-photo';
import { HandoverStep7Checklist } from './wizard-steps/step7-checklist';
import { HandoverStep8Summary } from './wizard-steps/step8-summary';
import { useSearchParams, useRouter } from 'next/navigation';

const STEPS = [
  { id: 'vehicle', title: 'Fahrzeug wählen', component: HandoverStep1Vehicle },
  { id: 'drivers', title: 'Fahrer wählen', component: HandoverStep2Drivers },
  { id: 'odometer', title: 'Kilometerstand', component: HandoverStep3Odometer },
  { id: 'existingDamage', title: 'Vorschäden prüfen', component: HandoverStep4ExistingDamage },
  { id: 'newDamage', title: 'Neue Schäden', component: HandoverStep5NewDamage },
  { id: 'photo_front', title: 'Foto: Front', component: () => <HandoverStepPhoto photoKey="front" title="Frontansicht" /> },
  { id: 'photo_rear', title: 'Foto: Heck', component: () => <HandoverStepPhoto photoKey="rear" title="Heckansicht" /> },
  { id: 'photo_left', title: 'Foto: Linke Seite', component: () => <HandoverStepPhoto photoKey="left" title="Fahrerseite" /> },
  { id: 'photo_right', title: 'Foto: Rechte Seite', component: () => <HandoverStepPhoto photoKey="right" title="Beifahrerseite" /> },
  { id: 'photo_mirror_left', title: 'Foto: Spiegel Links', component: () => <HandoverStepPhoto photoKey="mirror_left" title="Außenspiegel Links" /> },
  { id: 'photo_mirror_right', title: 'Foto: Spiegel Rechts', component: () => <HandoverStepPhoto photoKey="mirror_right" title="Außenspiegel Rechts" /> },
  { id: 'checklist', title: 'Checkliste', component: HandoverStep7Checklist },
  { id: 'summary', title: 'Zusammenfassung', component: HandoverStep8Summary },
];

function HandoverWizardContent() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const { handoverData, resetHandoverData } = useHandoverState();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Reset state on component mount if not coming from a scan
  useEffect(() => {
    if (!searchParams.get('vehicleId')) {
      resetHandoverData();
    }
  }, []);

  const isStepValid = () => {
    switch (currentStepIndex) {
      case 0: // Vehicle
        return !!handoverData.vehicleId;
      case 1: // Drivers
        return !!handoverData.toDriverId && (!!handoverData.fromDriverId || handoverData.fromDriverId === null);
      case 2: // Odometer
        return handoverData.odometerKm !== null && handoverData.odometerKm >= 0;
      case 3: // Existing Damage
        return handoverData.existingDamageConfirmed || (handoverData.existingDamageConfirmed === false && !!handoverData.notes);
      case 4: // New Damage
        return true;
      case 5:
        return handoverData.requiredPhotos.front.status !== 'missing';
      case 6:
        return handoverData.requiredPhotos.rear.status !== 'missing';
      case 7:
        return handoverData.requiredPhotos.left.status !== 'missing';
      case 8:
        return handoverData.requiredPhotos.right.status !== 'missing';
      case 9:
        return handoverData.requiredPhotos.mirror_left.status !== 'missing';
      case 10:
        return handoverData.requiredPhotos.mirror_right.status !== 'missing';
      // Subsequent steps are always valid to proceed from, as they have internal logic or are optional
      default:
        return true;
    }
  };

  const goToNextStep = () => {
    if (isStepValid()) {
      setCurrentStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const goToPrevStep = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };
  
  const isLastStep = currentStepIndex === STEPS.length - 1;
  const CurrentStepComponent = STEPS[currentStepIndex].component;
  const progressValue = ((currentStepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Progress value={progressValue} className="w-full" />
        <p className="text-sm text-muted-foreground">
          Schritt {currentStepIndex + 1} von {STEPS.length}: {STEPS[currentStepIndex].title}
        </p>
      </div>

      <div className="py-6 min-h-[300px]">
        <CurrentStepComponent />
      </div>

      {!isLastStep && (
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={goToPrevStep}
            disabled={currentStepIndex === 0}
          >
            Zurück
          </Button>
          <Button
            onClick={goToNextStep}
            disabled={!isStepValid()}
          >
            Weiter
          </Button>
        </div>
      )}
    </div>
  );
}


export function HandoverWizard() {
  return (
    <HandoverStateProvider>
      <HandoverWizardContent />
    </HandoverStateProvider>
  );
}
