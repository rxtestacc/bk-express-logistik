'use client';

import React, { useMemo, useState } from 'react';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, 
    Settings2, 
    Group, 
    Euro, 
    TrendingUp, 
    Calculator, 
    Car,
    ArrowUpDown,
    FileSpreadsheet
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInMonths, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { Skeleton } from '../ui/skeleton';

interface MasterRow {
    id: string;
    license_plate: string;
    vin: string;
    make: string;
    model: string;
    first_registration: string;
    purchase_date: string;
    leasing_company: string;
    contract_number: string;
    carrier: string;
    fleet_type: string;
    leasing_rate: number;
    first_installment: string;
    last_installment: string;
    duration: string;
    purchase_price: number;
    total_costs: number;
    warranty_end: string;
    status: string;
}

const COLUMNS = [
    { id: 'license_plate', label: 'Kennzeichen', always: true, minWidth: '140px', align: 'left' },
    { id: 'vin', label: 'VIN / Fahrgestellnummer', always: false, minWidth: '200px', align: 'left' },
    { id: 'make', label: 'Hersteller', always: true, minWidth: '130px', align: 'left' },
    { id: 'model', label: 'Modellbezeichnung', always: true, minWidth: '180px', align: 'left' },
    { id: 'carrier', label: 'Auftraggeber', always: true, minWidth: '130px', align: 'left' },
    { id: 'status', label: 'Status', always: true, minWidth: '120px', align: 'left' },
    { id: 'leasing_rate', label: 'Rate (Mtl.)', always: false, minWidth: '120px', align: 'right' },
    { id: 'purchase_price', label: 'Investition', always: false, minWidth: '130px', align: 'right' },
    { id: 'total_costs', label: 'FZG-Kosten', always: false, minWidth: '130px', align: 'right' },
    { id: 'duration', label: 'Laufzeit', always: false, minWidth: '130px', align: 'left' },
    { id: 'first_registration', label: 'Erstzulassung', always: false, minWidth: '120px', align: 'left' },
    { id: 'purchase_date', label: 'Zulassung BK', always: false, minWidth: '120px', align: 'left' },
    { id: 'leasing_company', label: 'Finanzpartner', always: false, minWidth: '180px', align: 'left' },
    { id: 'contract_number', label: 'Vertragsnummer', always: false, minWidth: '160px', align: 'left' },
    { id: 'first_installment', label: 'Ersterate', always: false, minWidth: '120px', align: 'left' },
    { id: 'last_installment', label: 'Schlussrate', always: false, minWidth: '120px', align: 'left' },
    { id: 'warranty_end', label: 'Garantie bis', always: false, minWidth: '120px', align: 'left' },
    { id: 'fleet_type', label: 'Fuhrparktyp', always: false, minWidth: '120px', align: 'left' },
];

const StatCard = ({ title, value, icon: Icon, colorClass }: { title: string, value: string, icon: any, colorClass: string }) => (
    <Card className="border-primary/10 shadow-sm overflow-hidden bg-card/50">
        <CardContent className="p-4">
            <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl text-white shadow-lg", colorClass)}>
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{title}</p>
                    <p className="text-lg font-bold tracking-tight font-mono">{value}</p>
                </div>
            </div>
        </CardContent>
    </Card>
);

export function MasterListTable() {
    const { vehicles, contracts, isLoading } = useDashboardData();
    const [searchTerm, setSearchTerm] = useState('');
    const [groupBy, setGroupBy] = useState<string>('none');
    const [visibleColumns, setVisibleColumns] = useState<string[]>(COLUMNS.map(c => c.id));
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'license_plate', direction: 'asc' });

    const mergedData = useMemo(() => {
        if (!vehicles) return [];

        return vehicles.map(v => {
            const vehicleContracts = contracts.filter(c => 
                c.vehicleId === v.id || 
                (c.extracted?.vin && c.extracted.vin.toLowerCase() === v.vin?.toLowerCase())
            );
            
            const leasingContract = vehicleContracts.find(c => c.contractType === 'leasing' || c.contractType === 'financing') || vehicleContracts[0];

            const parseDate = (ts: any) => {
                if (!ts) return null;
                return ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
            };

            const formatDateStr = (date: Date | null) => {
                if (!date || isNaN(date.getTime())) return '';
                return format(date, 'dd.MM.yyyy');
            };

            const dFirst = parseDate(v.first_installment_date);
            const dLast = parseDate(v.last_installment_date);
            
            let durationStr = '';
            if (dFirst && dLast && dLast > dFirst) {
                const months = differenceInMonths(dLast, dFirst);
                const remainingDays = differenceInDays(dLast, new Date(dFirst.getFullYear(), dFirst.getMonth() + months, dFirst.getDate()));
                durationStr = `${months} Mon.${remainingDays > 0 ? ` +${remainingDays} T.` : ''}`;
            }

            return {
                id: v.id,
                license_plate: v.license_plate,
                vin: v.vin,
                make: v.make,
                model: v.model,
                first_registration: formatDateStr(parseDate(v.first_registration)),
                purchase_date: formatDateStr(parseDate(v.purchase_date)),
                leasing_company: leasingContract?.providerName || v.leasing_company || '-',
                contract_number: leasingContract?.contractNumber || '-',
                carrier: v.carrier || 'Nicht zugeordnet',
                fleet_type: v.fleet_type || 'Ja',
                leasing_rate: leasingContract?.monthlyCostEur || v.leasing_rate_eur || 0,
                first_installment: formatDateStr(dFirst),
                last_installment: formatDateStr(dLast),
                duration: durationStr,
                purchase_price: v.purchase_price || 0,
                total_costs: v.total_costs_eur || 0,
                warranty_end: formatDateStr(parseDate(v.warranty_end)),
                status: v.status
            } as MasterRow;
        });
    }, [vehicles, contracts]);

    const filteredData = useMemo(() => {
        let data = [...mergedData];
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            data = data.filter(row => 
                Object.values(row).some(val => String(val).toLowerCase().includes(term))
            );
        }

        data.sort((a: any, b: any) => {
            const aV = a[sortConfig.key];
            const bV = b[sortConfig.key];
            if (aV < bV) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aV > bV) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [mergedData, searchTerm, sortConfig]);

    const stats = useMemo(() => {
        return filteredData.reduce((acc, row) => {
            acc.monthlyRateTotal += row.leasing_rate || 0;
            acc.investmentTotal += row.purchase_price || 0;
            acc.runningCostsTotal += row.total_costs || 0;
            return acc;
        }, { monthlyRateTotal: 0, investmentTotal: 0, runningCostsTotal: 0, count: filteredData.length });
    }, [filteredData]);

    const groupedData = useMemo(() => {
        if (groupBy === 'none') return { 'Alle Fahrzeuge': filteredData };
        
        return filteredData.reduce((acc: any, row: any) => {
            const key = row[groupBy] || 'Unbekannt';
            if (!acc[key]) acc[key] = [];
            acc[key].push(row);
            return acc;
        }, {});
    }, [filteredData, groupBy]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const toggleColumn = (id: string) => {
        setVisibleColumns(prev => 
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const formatCurrency = (val: number) => {
        return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    };

    const exportToExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(filteredData.map(row => {
            const exportRow: any = {};
            COLUMNS.filter(c => visibleColumns.includes(c.id)).forEach(col => {
                exportRow[col.label] = (row as any)[col.id];
            });
            return exportRow;
        }));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Fuhrpark Masterliste");
        XLSX.writeFile(workbook, `Masterliste_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                </div>
                <Skeleton className="h-[500px] w-full rounded-2xl" />
            </div>
        );
    }

    const visibleColsData = COLUMNS.filter(c => visibleColumns.includes(c.id));

    return (
        <div className="space-y-6 flex flex-col h-full overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                <StatCard title="Gesamt Rate (mtl.)" value={formatCurrency(stats.monthlyRateTotal)} icon={Euro} colorClass="bg-primary" />
                <StatCard title="Investitionsvolumen" value={formatCurrency(stats.investmentTotal)} icon={TrendingUp} colorClass="bg-indigo-600" />
                <StatCard title="FZG-Kosten (Gesamt)" value={formatCurrency(stats.runningCostsTotal)} icon={Calculator} colorClass="bg-amber-600" />
                <StatCard title="Einheiten im Bestand" value={`${stats.count}`} icon={Car} colorClass="bg-slate-700" />
            </div>

            <Card className="border-none shadow-2xl bg-card overflow-hidden ring-1 ring-border flex flex-col flex-1 min-h-0">
                <CardHeader className="bg-muted/30 border-b pb-6 shrink-0">
                    <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                        <div className="relative w-full lg:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Suche in allen Feldern..." 
                                className="pl-9 h-11 bg-background rounded-xl border-primary/10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                            <div className="flex items-center gap-2 bg-background border rounded-xl px-3 h-11 shadow-sm">
                                <Group className="h-4 w-4 text-primary" />
                                <Select value={groupBy} onValueChange={setGroupBy}>
                                    <SelectTrigger className="border-none shadow-none focus:ring-0 h-8 w-32 bg-transparent p-0 font-bold text-xs uppercase">
                                        <SelectValue placeholder="Gruppieren" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="z-[150]">
                                        <SelectItem value="none">Keine Gruppe</SelectItem>
                                        <SelectItem value="make">Fabrikat</SelectItem>
                                        <SelectItem value="carrier">Auftraggeber</SelectItem>
                                        <SelectItem value="leasing_company">Finanzpartner</SelectItem>
                                        <SelectItem value="status">Status</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-11 rounded-xl font-bold text-xs uppercase">
                                        <Settings2 className="mr-2 h-4 w-4" /> Spalten
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64 p-2">
                                    <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest">Sichtbare Spalten</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <ScrollArea className="h-80 pr-2">
                                        {COLUMNS.map(col => (
                                            <DropdownMenuCheckboxItem
                                                key={col.id}
                                                checked={visibleColumns.includes(col.id)}
                                                onCheckedChange={() => toggleColumn(col.id)}
                                                disabled={col.always}
                                                className="text-xs"
                                            >
                                                {col.label}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </ScrollArea>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button onClick={exportToExcel} variant="secondary" className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase">
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel Export
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="p-0 flex-1 overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="w-max min-w-full inline-block align-middle">
                            <Table className="border-collapse">
                                <TableHeader className="bg-muted/95 sticky top-0 z-30 shadow-sm border-b">
                                    <TableRow className="hover:bg-transparent">
                                        {visibleColsData.map(col => (
                                            <TableHead 
                                                key={col.id} 
                                                style={{ minWidth: col.minWidth, width: col.minWidth }}
                                                className={cn(
                                                    "font-bold text-[11px] uppercase tracking-wider py-4 px-4 cursor-pointer hover:text-primary transition-colors whitespace-nowrap",
                                                    col.align === 'right' ? 'text-right' : 'text-left'
                                                )}
                                                onClick={() => handleSort(col.id)}
                                            >
                                                <div className={cn("flex items-center gap-1.5", col.align === 'right' ? 'justify-end' : 'justify-start')}>
                                                    {col.label}
                                                    <ArrowUpDown className={cn("h-3 w-3", sortConfig.key === col.id ? "opacity-100" : "opacity-20")} />
                                                </div>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Object.entries(groupedData).map(([groupKey, rows]: [string, any]) => (
                                        <React.Fragment key={groupKey}>
                                            {groupBy !== 'none' && (
                                                <TableRow className="bg-muted/40 hover:bg-muted/60 border-y sticky left-0 z-10">
                                                    <TableCell colSpan={visibleColsData.length} className="py-2.5 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <Badge className="bg-primary text-white font-bold uppercase text-[10px] tracking-wider">
                                                                {groupKey}
                                                            </Badge>
                                                            <span className="text-[10px] font-bold text-muted-foreground/70">({rows.length} Einheiten)</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {rows.map((row: MasterRow) => (
                                                <TableRow 
                                                    key={row.id} 
                                                    className="group hover:bg-primary/[0.02] border-b transition-colors cursor-pointer"
                                                    onClick={() => window.open(`/fahrzeuge/${row.id}`, '_blank')}
                                                >
                                                    {visibleColsData.map(col => {
                                                        const val = (row as any)[col.id];
                                                        return (
                                                            <TableCell 
                                                                key={col.id} 
                                                                className={cn(
                                                                    "py-3.5 px-4 text-sm font-medium whitespace-nowrap border-r border-border/10 last:border-r-0",
                                                                    col.align === 'right' ? 'text-right' : 'text-left'
                                                                )}
                                                            >
                                                                {col.id === 'license_plate' ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold tracking-tight font-mono text-primary">{val}</span>
                                                                        {row.status === 'in_werkstatt' && (
                                                                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="In Werkstatt" />
                                                                        )}
                                                                    </div>
                                                                ) : typeof val === 'number' ? (
                                                                    <span className={cn(val > 0 ? "text-foreground" : "text-muted-foreground/30", "font-mono font-medium")}>
                                                                        {val > 0 ? formatCurrency(val) : '-'}
                                                                    </span>
                                                                ) : col.id === 'carrier' ? (
                                                                    <Badge variant="outline" className={cn(
                                                                        "text-[10px] font-bold uppercase px-2 py-0 border-none shadow-none",
                                                                        val === 'GLS' ? "bg-amber-100 text-amber-800" : 
                                                                        val === 'Hermes' ? "bg-blue-100 text-blue-800" : 
                                                                        "bg-slate-100 text-slate-800"
                                                                    )}>
                                                                        {val}
                                                                    </Badge>
                                                                ) : col.id === 'status' ? (
                                                                    <Badge variant="secondary" className={cn(
                                                                        "text-[9px] font-bold uppercase px-2 py-0 border-none",
                                                                        val === 'aktiv' ? "bg-status-green/10 text-status-green" :
                                                                        val === 'in_werkstatt' ? "bg-status-yellow/10 text-status-yellow" :
                                                                        "bg-status-red/10 text-status-red"
                                                                    )}>
                                                                        {val}
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-foreground/70">{val || '-'}</span>
                                                                )}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}