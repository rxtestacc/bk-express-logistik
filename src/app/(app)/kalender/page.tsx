'use client';

import { useState } from 'react';
import EventCalendar from '@/components/calendar/event-calendar';
import { UpcomingReminders } from '@/components/dashboard/upcoming-reminders';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';
import { VoiceTaskDialog } from '@/components/tasks/voice-task-dialog';

export default function KalenderPage() {
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold md:text-3xl">Kalender</h1>
            <Button variant="outline" onClick={() => setIsVoiceDialogOpen(true)} className="border-primary/40 hover:border-primary text-primary bg-primary/5">
              <Mic className="mr-2 h-4 w-4" />
              Spracheingabe
            </Button>
        </div>
        <EventCalendar />
        
        <div className="pt-8">
            <UpcomingReminders />
        </div>

        <VoiceTaskDialog 
          isOpen={isVoiceDialogOpen}
          onOpenChange={setIsVoiceDialogOpen}
          mode="task"
        />
    </div>
  );
}
