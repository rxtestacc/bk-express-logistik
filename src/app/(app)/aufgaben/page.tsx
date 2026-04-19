'use client';

import { useState } from 'react';
import { PlusCircle, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskList } from '@/components/tasks/task-list';
import { TaskFormSheet } from '@/components/tasks/task-form-sheet';
import type { Task } from '@/components/tasks/task-form-sheet';
import { VoiceTaskDialog } from '@/components/tasks/voice-task-dialog';

export default function AufgabenPage() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const handleAddTask = () => {
    setEditingTask(undefined);
    setIsSheetOpen(true);
  };
  
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsSheetOpen(true);
  };

  const handleSheetOpenChange = (isOpen: boolean) => {
    setIsSheetOpen(isOpen);
    if (!isOpen) {
      setEditingTask(undefined);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold md:text-3xl">Aufgaben</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsVoiceDialogOpen(true)} className="flex-1 md:flex-none border-primary/40 hover:border-primary text-primary bg-primary/5">
              <Mic className="mr-2 h-4 w-4" />
              Per Sprache erfassen
            </Button>
            <Button onClick={handleAddTask} className="flex-1 md:flex-none">
              <PlusCircle className="mr-2 h-4 w-4" />
              Neue Aufgabe
            </Button>
          </div>
        </div>
        <TaskList onEditTask={handleEditTask} />
      </div>

      <TaskFormSheet
        isOpen={isSheetOpen}
        onOpenChange={handleSheetOpenChange}
        taskData={editingTask}
      />

      <VoiceTaskDialog 
        isOpen={isVoiceDialogOpen}
        onOpenChange={setIsVoiceDialogOpen}
        onTaskCreated={() => {
            // TaskList should auto-refresh via real-time hooks
        }}
      />
    </>
  );
}
