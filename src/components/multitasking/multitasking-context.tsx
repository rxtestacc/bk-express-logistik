'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/hooks/use-session';

export interface OpenTask {
  id: string;
  path: string;
  title: string;
  type: 'dashboard' | 'vehicle' | 'driver' | 'task' | 'event' | 'contract' | 'other';
  icon?: string;
}

interface MultitaskingContextType {
  tasks: OpenTask[];
  activeTaskId: string | null;
  addTask: (path: string, title: string, type: OpenTask['type']) => void;
  removeTask: (id: string) => void;
  switchTask: (id: string) => void;
  clearAllTasks: () => void;
}

const MultitaskingContext = createContext<MultitaskingContextType | undefined>(undefined);

export function MultitaskingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useSession();
  const [tasks, setTasks] = useState<OpenTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Load tasks from localStorage on mount (scoped by user)
  useEffect(() => {
    if (session?.name) {
      const saved = localStorage.getItem(`bk_tasks_${session.name}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Ensure we don't load dashboard into the dynamic list if it was saved previously
          const filtered = parsed.filter((t: OpenTask) => t.path !== '/dashboard');
          setTasks(filtered);
        } catch (e) {
          console.error("Failed to parse saved tasks", e);
        }
      }
    }
  }, [session?.name]);

  // Save tasks to localStorage when they change
  useEffect(() => {
    if (session?.name && tasks.length > 0) {
      localStorage.setItem(`bk_tasks_${session.name}`, JSON.stringify(tasks));
    } else if (session?.name) {
        localStorage.removeItem(`bk_tasks_${session.name}`);
    }
  }, [tasks, session?.name]);

  const addTask = useCallback((path: string, title: string, type: OpenTask['type']) => {
    if (path === '/dashboard') return;

    setTasks(prev => {
      const existing = prev.find(t => t.path === path);
      if (existing) return prev;

      const newTask: OpenTask = {
        id: Math.random().toString(36).substring(2, 9),
        path,
        title: title.length > 15 ? title.substring(0, 12) + '...' : title,
        type
      };
      
      return [...prev, newTask].slice(-10);
    });
  }, []);

  const removeTask = useCallback((id: string) => {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const newTasks = tasks.filter(t => t.id !== id);
    setTasks(newTasks);

    if (activeTaskId === id) {
      if (newTasks.length > 0) {
        const nextTask = newTasks[Math.min(taskIndex, newTasks.length - 1)];
        router.push(nextTask.path);
      } else {
        router.push('/dashboard');
      }
    }
  }, [activeTaskId, router, tasks]);

  const switchTask = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      router.push(task.path);
    }
  }, [tasks, router]);

  const clearAllTasks = useCallback(() => {
    setTasks([]);
    setActiveTaskId(null);
  }, []);

  // Update activeTaskId based on pathname
  useEffect(() => {
    const currentTask = tasks.find(t => t.path === pathname);
    if (currentTask) {
      setActiveTaskId(currentTask.id);
    } else if (pathname === '/dashboard') {
      setActiveTaskId(null);
    }
  }, [pathname, tasks]);

  // Monitor pathname changes to automatically add tasks
  useEffect(() => {
    const ignoredPaths = ['/', '/login', '/dashboard', '/debug-storage', '/debug-server-upload'];
    if (ignoredPaths.includes(pathname)) return;

    const existing = tasks.find(t => t.path === pathname);
    if (!existing) {
        let type: OpenTask['type'] = 'other';
        let title = pathname.split('/').pop() || 'Ansicht';

        if (pathname.includes('/fahrzeuge')) type = 'vehicle';
        else if (pathname.includes('/fahrer')) type = 'driver';
        else if (pathname.includes('/aufgaben')) type = 'task';
        else if (pathname.includes('/ereignisse')) type = 'event';
        else if (pathname.includes('/vertraege')) type = 'contract';

        setTasks(prev => {
            if (prev.find(t => t.path === pathname)) return prev;
            return [...prev, {
                id: Math.random().toString(36).substring(2, 9),
                path: pathname,
                title: title.length > 15 ? title.substring(0, 12) + '...' : title,
                type
            }].slice(-10);
        });
    }
  }, [pathname, tasks]);

  return (
    <MultitaskingContext.Provider value={{ tasks, activeTaskId, addTask, removeTask, switchTask, clearAllTasks }}>
      {children}
    </MultitaskingContext.Provider>
  );
}

export const useMultitasking = () => {
  const context = useContext(MultitaskingContext);
  if (!context) throw new Error('useMultitasking must be used within a MultitaskingProvider');
  return context;
};
