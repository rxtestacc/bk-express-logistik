'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import {
  Search,
  Car,
  User,
  ClipboardList,
  ShieldAlert,
  FileText,
  Command,
  ArrowRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'vehicle' | 'driver' | 'task' | 'event' | 'contract';
  url: string;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { vehicles, drivers, tasks, events, contracts } = useDashboardData();
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const results = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    const matches: SearchResult[] = [];

    vehicles?.forEach(v => {
      if (v.license_plate?.toLowerCase().includes(term) || v.make?.toLowerCase().includes(term) || v.model?.toLowerCase().includes(term)) {
        matches.push({ id: v.id, title: v.license_plate, subtitle: `${v.make} ${v.model}`, type: 'vehicle', url: `/fahrzeuge/${v.id}` });
      }
    });

    drivers?.forEach(d => {
      if (d.first_name?.toLowerCase().includes(term) || d.last_name?.toLowerCase().includes(term)) {
        matches.push({ id: d.id, title: `${d.first_name} ${d.last_name}`, subtitle: d.email, type: 'driver', url: `/fahrer/${d.id}` });
      }
    });

    tasks?.forEach(t => {
      if (t.title?.toLowerCase().includes(term)) {
        matches.push({ id: t.id, title: t.title, subtitle: 'Aufgabe', type: 'task', url: `/aufgaben/${t.id}` });
      }
    });

    events?.forEach(e => {
      if (e.title?.toLowerCase().includes(term)) {
        matches.push({ id: e.id, title: e.title, subtitle: 'Ereignis', type: 'event', url: `/ereignisse/${e.id}` });
      }
    });

    contracts?.forEach(c => {
      if (c.providerName?.toLowerCase().includes(term) || c.contractNumber?.toLowerCase().includes(term)) {
        matches.push({ id: c.id, title: c.providerName || 'Vertrag', subtitle: c.contractNumber, type: 'contract', url: `/vertraege/${c.id}` });
      }
    });

    return matches;
  }, [searchTerm, vehicles, drivers, tasks, events, contracts]);

  const handleSelect = useCallback((url: string) => {
    setIsOpen(false);
    setSearchTerm('');
    router.push(url);
  }, [router]);

  return (
    <>
      <Button
        variant="outline"
        className="relative w-full justify-start text-base text-muted-foreground md:w-[400px] lg:w-[600px] h-10 md:h-12 bg-muted/40 border-2 border-primary/10 hover:border-primary/40 hover:bg-muted/60 transition-all shadow-sm rounded-xl"
        onClick={() => setIsOpen(true)}
      >
        <Search className="mr-3 h-4 w-4 md:h-5 md:w-5 text-primary/60" />
        <span className="font-normal text-sm md:text-base">BK-Express durchsuchen...</span>
        <kbd className="pointer-events-none absolute right-2 top-2.5 hidden h-6 select-none items-center gap-1 rounded border bg-background px-2 font-mono text-[12px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-[700px] top-[10%] sm:top-[25%] translate-y-0 shadow-2xl border-none">
          <DialogHeader className="sr-only"><DialogTitle>Globale Suche</DialogTitle></DialogHeader>
          <div className="px-4 py-4 border-b bg-muted/10">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <Input
                placeholder="Fahrzeug, Fahrer, Aufgabe oder Vertrag suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-none focus-visible:ring-0 text-lg md:text-xl p-0 h-auto bg-transparent"
                autoFocus
              />
            </div>
          </div>
          
          <ScrollArea className="max-h-[60vh] md:max-h-[500px]">
            <div className="p-2">
              {!searchTerm && (
                <div className="p-12 text-center text-muted-foreground">
                  <Command className="h-12 w-12 mx-auto mb-4 opacity-10" />
                  <p className="text-lg">Schnellsuche starten</p>
                </div>
              )}
              {results.length > 0 && (
                <div className="space-y-4 py-2">
                  <ResultSection title="Fahrzeuge" icon={Car} items={results.filter(r => r.type === 'vehicle')} onSelect={handleSelect} />
                  <ResultSection title="Fahrer" icon={User} items={results.filter(r => r.type === 'driver')} onSelect={handleSelect} />
                  <ResultSection title="Verträge" icon={FileText} items={results.filter(r => r.type === 'contract')} onSelect={handleSelect} />
                  <ResultSection title="Aufgaben" icon={ClipboardList} items={results.filter(r => r.type === 'task')} onSelect={handleSelect} />
                  <ResultSection title="Ereignisse" icon={ShieldAlert} items={results.filter(r => r.type === 'event')} onSelect={handleSelect} />
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResultSection({ title, icon: Icon, items, onSelect }: { title: string, icon: any, items: SearchResult[], onSelect: (url: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="px-2">
      <h3 className="px-3 py-2 text-xs font-bold text-primary/70 flex items-center gap-2 uppercase tracking-widest">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h3>
      <div className="space-y-1">
        {items.map((item) => (
          <button key={item.id} onClick={() => onSelect(item.url)} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-primary/5 text-left transition-all border border-transparent hover:border-primary/10">
            <div className="flex-1 min-w-0">
              <div className="text-sm md:text-base font-semibold truncate">{item.title}</div>
              {item.subtitle && <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>}
            </div>
            <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}
