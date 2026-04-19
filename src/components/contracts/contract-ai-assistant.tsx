'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Loader2, User, MessageSquareQuote, Sparkles } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { askContractAssistant } from '@/ai/flows/contract-assistant-flow';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { Contract, Vehicle } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ContractAIAssistantProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContractAIAssistant({ isOpen, onOpenChange }: ContractAIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const firestore = useFirestore();
  const router = useRouter();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // Load all data for context
  const contractsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'contracts')) : null, [firestore]);
  const vehiclesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'vehicles')) : null, [firestore]);
  
  const { data: contracts } = useCollection<Contract>(contractsQuery);
  const { data: vehicles } = useCollection<Vehicle>(vehiclesQuery);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      // Build deep context with AI summaries from original documents
      const contextData = contracts?.map(c => {
        const vehicle = vehicles?.find(v => v.id === c.vehicleId);
        return {
          id: c.id,
          vehicle_plate: vehicle?.license_plate || '?',
          vehicle_info: vehicle ? `${vehicle.make} ${vehicle.model}` : '?',
          type: c.contractType,
          partner: c.providerName,
          number: c.contractNumber,
          end_date: c.endDate?.toDate().toLocaleDateString('de-DE'),
          cost: c.monthlyCostEur,
          status: c.contractStatus,
          // CRITICAL: Include the full AI-generated summary of the original document
          document_summary: c.summary || c.notes || 'Keine detaillierte Inhaltsbeschreibung verfügbar.'
        };
      });

      const result = await askContractAssistant({
        question: userMessage,
        contractsContext: JSON.stringify(contextData)
      });

      setMessages(prev => [...prev, { role: 'assistant', content: result.answer }]);
    } catch (error: any) {
      console.error('AI Assistant Error:', error);
      let errorMsg = 'Entschuldigung, ich konnte die Vertragsdaten momentan nicht analysieren.';
      
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = 'Das KI-Limit wurde erreicht. Bitte warten Sie 60 Sekunden, bevor Sie die nächste Frage stellen.';
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary rounded-2xl text-primary-foreground shadow-lg">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight">BK-Express Vertrags-Profi</DialogTitle>
              <DialogDescription className="text-sm font-medium">
                Ich kenne alle Details Ihrer Leasing- und Garantieverträge.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 bg-muted/10">
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-6 opacity-60">
                <div className="p-6 bg-background rounded-full shadow-inner">
                    <Sparkles className="h-12 w-12 text-primary/40" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-bold">Wie kann ich Ihnen helfen?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground max-w-lg mx-auto">
                    <div className="p-3 bg-background rounded-xl border border-primary/5">"Was steht in der Garantieverlängerung von BK-2067?"</div>
                    <div className="p-3 bg-background rounded-xl border border-primary/5">"Welche Verträge kosten mehr als 500€?"</div>
                    <div className="p-3 bg-background rounded-xl border border-primary/5">"Wann ist der nächste Kündigungstermin?"</div>
                    <div className="p-3 bg-background rounded-xl border border-primary/5">"Liste alle Leasingverträge auf."</div>
                  </div>
                </div>
              </div>
            )}
            
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2",
                  m.role === 'assistant' ? "justify-start" : "justify-end flex-row-reverse"
                )}
              >
                <div className={cn(
                  "p-2.5 rounded-xl shrink-0 shadow-sm mt-1",
                  m.role === 'assistant' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {m.role === 'assistant' ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                </div>
                <div className={cn(
                  "max-w-[85%] p-5 rounded-2xl shadow-md border",
                  m.role === 'assistant' 
                    ? "bg-card text-foreground" 
                    : "bg-primary text-primary-foreground border-transparent"
                )}>
                  <ReactMarkdown 
                    className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed"
                    components={{
                      a: ({ node, ...props }) => {
                        const isInternal = props.href?.startsWith('/');
                        if (isInternal) {
                          return (
                            <button
                              onClick={() => {
                                onOpenChange(false);
                                router.push(props.href!);
                              }}
                              className="text-primary hover:underline font-black bg-primary/10 px-1.5 py-0.5 rounded-md transition-colors"
                            >
                              {props.children}
                            </button>
                          );
                        }
                        return <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary underline font-bold" />;
                      }
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex items-start gap-4 animate-pulse">
                <div className="p-2.5 bg-primary text-primary-foreground rounded-xl shadow-sm">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="bg-card border p-5 rounded-2xl shadow-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-background">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex w-full gap-3 max-w-3xl mx-auto"
          >
            <Input
              placeholder="Frage zu Ihren Dokumenten..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping}
              className="flex-1 h-14 text-base rounded-2xl shadow-inner border-primary/10 focus-visible:ring-primary/20"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="h-14 w-14 rounded-2xl shadow-xl transition-all active:scale-90"
              disabled={isTyping || !input.trim()}
            >
              <Send className="h-6 w-6" />
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
