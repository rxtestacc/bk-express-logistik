'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
    Trash2, 
    RotateCw, 
    Square, 
    Type, 
    Map, 
    Save, 
    Milestone,
    User,
    Home,
    Signpost,
    Lightbulb,
    Grid3X3,
    ArrowRight
} from 'lucide-react';
import type { AccidentSketchElement } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AccidentSketchBuilderProps {
    initialData?: AccidentSketchElement[];
    onSave: (elements: AccidentSketchElement[], imageBase64: string) => void;
    onCancel: () => void;
}

const getZIndex = (type: AccidentSketchElement['type']) => {
    if (type.startsWith('road_')) return 1;
    if (['house', 'obstacle', 'lamp_post', 'sign'].includes(type)) return 10;
    if (['vehicle_own', 'vehicle_third', 'pedestrian'].includes(type)) return 20;
    if (type === 'text') return 30;
    return 5;
};

export function AccidentSketchBuilder({ initialData = [], onSave, onCancel }: AccidentSketchBuilderProps) {
    const [elements, setElements] = useState<AccidentSketchElement[]>(initialData);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const selectedElement = elements.find(el => el.id === selectedId);

    const addElement = (type: AccidentSketchElement['type']) => {
        const newEl: AccidentSketchElement = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            x: 150,
            y: 150,
            rotation: 0,
            text: type === 'text' ? 'Hinweis' : undefined,
        };
        setElements([...elements, newEl]);
        setSelectedId(newEl.id);
    };

    const updateElement = (id: string, updates: Partial<AccidentSketchElement>) => {
        setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
    };

    const removeElement = (id: string) => {
        setElements(elements.filter(el => el.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedId(id);
        setIsDragging(true);
        const el = elements.find(el => el.id === id);
        if (el) {
            setDragOffset({
                x: e.clientX - el.x,
                y: e.clientY - el.y
            });
        }
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !selectedId) return;
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        
        const safeX = Math.max(-100, Math.min(x, 900));
        const safeY = Math.max(-100, Math.min(y, 600));
        
        updateElement(selectedId, { x: safeX, y: safeY });
    }, [isDragging, selectedId, dragOffset]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const renderElement = (el: AccidentSketchElement) => {
        const isSelected = selectedId === el.id;
        const zIndex = getZIndex(el.type);
        
        const content = () => {
            switch (el.type) {
                case 'vehicle_own':
                    return (
                        <div className="w-20 h-10 bg-blue-600 rounded-sm flex items-center justify-center border-2 border-white shadow-lg relative overflow-hidden">
                            {/* Car top structure */}
                            <div className="absolute top-1 left-2 right-6 bottom-1 bg-blue-700/50 rounded-sm" />
                            {/* Windows */}
                            <div className="absolute left-2 top-1.5 w-3 bottom-1.5 bg-sky-200/40 rounded-sm" />
                            <div className="absolute right-6 top-1.5 w-2 bottom-1.5 bg-sky-200/40 rounded-sm" />
                            {/* Counter-rotating text */}
                            <span 
                                className="text-[10px] text-white font-black z-10 select-none pointer-events-none"
                                style={{ transform: `rotate(${-el.rotation}deg)` }}
                            >
                                BK-FZG
                            </span>
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 bg-white/20 rounded-full flex items-center justify-center">
                                <ArrowRight className="h-3 w-3 text-white" />
                            </div>
                        </div>
                    );
                case 'vehicle_third':
                    return (
                        <div className="w-20 h-10 bg-red-600 rounded-sm flex items-center justify-center border-2 border-white shadow-lg relative overflow-hidden">
                            <div className="absolute top-1 left-2 right-6 bottom-1 bg-red-700/50 rounded-sm" />
                            <div className="absolute left-2 top-1.5 w-3 bottom-1.5 bg-sky-200/40 rounded-sm" />
                            <div className="absolute right-6 top-1.5 w-2 bottom-1.5 bg-sky-200/40 rounded-sm" />
                            <span 
                                className="text-[10px] text-white font-black z-10 select-none pointer-events-none"
                                style={{ transform: `rotate(${-el.rotation}deg)` }}
                            >
                                GEGNER
                            </span>
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 bg-white/20 rounded-full flex items-center justify-center">
                                <ArrowRight className="h-3 w-3 text-white" />
                            </div>
                        </div>
                    );
                case 'road_straight':
                    return (
                        <div className="w-48 h-32 bg-slate-200 border-y-4 border-slate-400 flex items-center justify-center relative">
                            <div className="w-full h-0.5 border-t-2 border-dashed border-white opacity-60"></div>
                        </div>
                    );
                case 'road_curve':
                    return (
                        <div className="w-40 h-40 bg-slate-200 rounded-tr-full border-t-4 border-r-4 border-slate-400 relative overflow-hidden">
                            <div className="absolute inset-4 border-t-2 border-r-2 border-dashed border-white rounded-tr-full opacity-60"></div>
                        </div>
                    );
                case 'road_intersection':
                    return (
                        <div className="w-64 h-64 bg-slate-200 relative">
                            {/* Horizontal Road */}
                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-24 border-y-4 border-slate-400 flex items-center justify-center">
                                <div className="w-full h-0.5 border-t-2 border-dashed border-white opacity-40"></div>
                            </div>
                            {/* Vertical Road */}
                            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-24 border-x-4 border-slate-400 flex items-center justify-center">
                                <div className="h-full w-0.5 border-l-2 border-dashed border-white opacity-40"></div>
                            </div>
                            {/* Center clear area */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[88px] h-[88px] bg-slate-200" />
                        </div>
                    );
                case 'obstacle':
                    return <div className="w-12 h-12 bg-zinc-800 rounded-sm shadow-xl flex items-center justify-center border-2 border-zinc-600"><Square className="text-zinc-400 h-5 w-5" /></div>;
                case 'pedestrian':
                    return (
                        <div className="p-1.5 bg-amber-100 border-2 border-amber-600 rounded-full shadow-md animate-pulse">
                            <User className="h-6 w-6 text-amber-800" />
                        </div>
                    );
                case 'house':
                    return (
                        <div className="p-3 bg-stone-200 border-2 border-stone-500 rounded-sm shadow-md flex flex-col items-center">
                            <div className="w-12 h-1 bg-stone-400 mb-1" /> {/* roof ridge */}
                            <Home className="h-10 w-10 text-stone-600" />
                        </div>
                    );
                case 'sign':
                    return (
                        <div className="p-1.5 bg-yellow-400 border-2 border-black rounded-sm shadow-lg flex items-center justify-center">
                            <Signpost className="h-6 w-6 text-black" />
                        </div>
                    );
                case 'lamp_post':
                    return (
                        <div className="w-6 h-6 bg-slate-400 border-2 border-slate-600 rounded-full shadow-md flex items-center justify-center">
                            <div className="w-2.5 h-2.5 bg-yellow-300 rounded-full blur-[1px]"></div>
                        </div>
                    );
                case 'text':
                    return (
                        <div className="px-3 py-1.5 bg-white border-2 border-primary/20 rounded shadow-md text-xs font-bold whitespace-nowrap text-primary uppercase tracking-tight">
                            {el.text}
                        </div>
                    );
                default:
                    return null;
            }
        };

        return (
            <div
                key={el.id}
                onMouseDown={(e) => handleMouseDown(e, el.id)}
                className={cn(
                    "absolute cursor-move select-none transition-all",
                    isSelected && "ring-4 ring-primary/40 ring-offset-2 z-[100] scale-105 shadow-2xl",
                    !isSelected && "hover:ring-2 hover:ring-primary/30"
                )}
                style={{
                    left: el.x,
                    top: el.y,
                    transform: `rotate(${el.rotation}deg)`,
                    zIndex: isSelected ? 100 : zIndex
                }}
            >
                {content()}
            </div>
        );
    };

    const handleSaveSketch = async () => {
        if (!canvasRef.current) return;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 1000;
        canvas.height = 600;

        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const sortedElements = [...elements].sort((a, b) => getZIndex(a.type) - getZIndex(b.type));

        sortedElements.forEach(el => {
            ctx.save();
            ctx.translate(el.x + (el.type.includes('vehicle') ? 40 : 0), el.y + (el.type.includes('vehicle') ? 20 : 0));
            ctx.rotate((el.rotation * Math.PI) / 180);
            
            // Adjust translation for center-based drawing on canvas
            ctx.translate(-(el.type.includes('vehicle') ? 40 : 0), -(el.type.includes('vehicle') ? 20 : 0));

            switch (el.type) {
                case 'vehicle_own':
                    ctx.fillStyle = '#2563eb';
                    ctx.fillRect(0, 0, 80, 40);
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(0, 0, 80, 40);
                    
                    // Windows
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(8, 6, 12, 28);
                    ctx.fillRect(56, 6, 8, 28);

                    // Text (Counter-rotated)
                    ctx.save();
                    ctx.translate(40, 20);
                    ctx.rotate(-(el.rotation * Math.PI) / 180);
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('BK-FZG', 0, 0);
                    ctx.restore();
                    break;
                case 'vehicle_third':
                    ctx.fillStyle = '#dc2626';
                    ctx.fillRect(0, 0, 80, 40);
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(0, 0, 80, 40);
                    
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(8, 6, 12, 28);
                    ctx.fillRect(56, 6, 8, 28);

                    ctx.save();
                    ctx.translate(40, 20);
                    ctx.rotate(-(el.rotation * Math.PI) / 180);
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('GEGNER', 0, 0);
                    ctx.restore();
                    break;
                case 'road_straight':
                    ctx.fillStyle = '#e2e8f0';
                    ctx.fillRect(0, 0, 192, 128);
                    ctx.strokeStyle = '#94a3b8';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(0, 0); ctx.lineTo(192, 0);
                    ctx.moveTo(0, 128); ctx.lineTo(192, 128);
                    ctx.stroke();
                    ctx.setLineDash([10, 10]);
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(0, 64); ctx.lineTo(192, 64);
                    ctx.stroke();
                    break;
                case 'road_intersection':
                    ctx.fillStyle = '#e2e8f0';
                    ctx.fillRect(0, 0, 256, 256);
                    ctx.strokeStyle = '#94a3b8';
                    ctx.lineWidth = 4;
                    // Draw horizontal and vertical borders with gaps
                    ctx.strokeRect(0, 0, 256, 256);
                    ctx.fillStyle = '#e2e8f0';
                    ctx.fillRect(80, -5, 96, 266);
                    ctx.fillRect(-5, 80, 266, 96);
                    // Central lines
                    ctx.setLineDash([10, 10]);
                    ctx.strokeStyle = 'white';
                    ctx.beginPath();
                    ctx.moveTo(0, 128); ctx.lineTo(256, 128);
                    ctx.moveTo(128, 0); ctx.lineTo(128, 256);
                    ctx.stroke();
                    break;
                case 'text':
                    ctx.fillStyle = '#2563eb';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.fillText((el.text || '').toUpperCase(), 0, 0);
                    break;
                case 'house':
                    ctx.fillStyle = '#d6d3d1';
                    ctx.fillRect(0, 0, 60, 60);
                    ctx.strokeStyle = '#78716c';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(0, 0, 60, 60);
                    break;
                case 'pedestrian':
                    ctx.fillStyle = '#b45309';
                    ctx.beginPath();
                    ctx.arc(15, 15, 15, 0, Math.PI * 2);
                    ctx.fill();
                    break;
            }
            ctx.restore();
        });

        const imageBase64 = canvas.toDataURL('image/png');
        onSave(elements, imageBase64);
    };

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => addElement('road_straight')}>
                        <Map className="mr-2 h-4 w-4" /> Straße
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('road_curve')}>
                        <RotateCw className="mr-2 h-4 w-4" /> Kurve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('road_intersection')}>
                        <Grid3X3 className="mr-2 h-4 w-4" /> Kreuzung
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('vehicle_own')} className="border-blue-500 text-blue-600 font-bold">
                        <ArrowRight className="mr-2 h-4 w-4" /> BK-Fzg
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('vehicle_third')} className="border-red-500 text-red-600 font-bold">
                        <ArrowRight className="mr-2 h-4 w-4" /> Gegner
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('pedestrian')}>
                        <User className="mr-2 h-4 w-4" /> Person
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('house')}>
                        <Home className="mr-2 h-4 w-4" /> Haus
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('sign')}>
                        <Signpost className="mr-2 h-4 w-4" /> Schild
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('lamp_post')}>
                        <Lightbulb className="mr-2 h-4 w-4" /> Laterne
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('obstacle')}>
                        <Square className="mr-2 h-4 w-4" /> Objekt
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('text')}>
                        <Type className="mr-2 h-4 w-4" /> Text
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={onCancel}>Abbrechen</Button>
                    <Button onClick={handleSaveSketch} className="bg-green-600 hover:bg-green-700 text-white">
                        <Save className="mr-2 h-4 w-4" /> Skizze speichern
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    <Card className="overflow-hidden border-2 border-dashed border-muted-foreground/20">
                        <CardContent className="p-0 bg-slate-100 relative h-[550px] overflow-hidden" ref={canvasRef} onMouseDown={() => setSelectedId(null)}>
                            {elements.length === 0 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none">
                                    <Milestone className="h-12 w-12 mb-2 opacity-20" />
                                    <p className="font-medium text-lg">Unfallskizze Editor</p>
                                    <p className="text-sm opacity-60">Fügen Sie Elemente über die obere Leiste hinzu.</p>
                                </div>
                            )}
                            {elements.map(renderElement)}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    {selectedElement ? (
                        <Card className="animate-in slide-in-from-right-2 border-primary/20">
                            <CardContent className="p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-primary">Element-Einstellungen</h4>
                                    <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => removeElement(selectedElement.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs">Rotation</Label>
                                        <span className="text-[10px] font-mono bg-muted px-1 rounded">{selectedElement.rotation}°</span>
                                    </div>
                                    <Slider 
                                        value={[selectedElement.rotation]} 
                                        max={360} 
                                        step={5} 
                                        onValueChange={([val]) => updateElement(selectedElement.id, { rotation: val })} 
                                    />
                                </div>

                                {selectedElement.type === 'text' && (
                                    <div className="space-y-2">
                                        <Label className="text-xs">Hinweistext</Label>
                                        <Input 
                                            value={selectedElement.text} 
                                            onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })} 
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                )}

                                <div className="p-3 bg-primary/5 rounded-md border border-primary/10">
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                                        <strong className="text-primary">Tipp:</strong> Nutzen Sie den Slider zur Rotation. Die Beschriftungen in Fahrzeugen bleiben automatisch lesbar.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="h-full flex items-center justify-center text-center p-6 border-2 border-dashed rounded-lg bg-muted/10 text-muted-foreground">
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Kein Element gewählt</p>
                                <p className="text-[10px] opacity-60">Klicken Sie ein Objekt auf der Skizze an, um es zu rotieren oder zu löschen.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}