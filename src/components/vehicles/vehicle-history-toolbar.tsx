
'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ListFilter, Search, X } from 'lucide-react';
import { eventTypeTranslations } from './vehicle-events';

interface VehicleHistoryToolbarProps {
  filterText: string;
  setFilterText: (text: string) => void;
  availableTypes: string[];
  selectedTypes: string[];
  setSelectedTypes: (types: string[]) => void;
}

export function VehicleHistoryToolbar({
  filterText,
  setFilterText,
  availableTypes,
  selectedTypes,
  setSelectedTypes,
}: VehicleHistoryToolbarProps) {
  const handleTypeSelectionChange = (type: string) => {
    const isSelected = selectedTypes.includes(type);
    if (isSelected) {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };
  
  const isFiltered = filterText !== '' || selectedTypes.length > 0;
  
  const resetFilters = () => {
    setFilterText('');
    setSelectedTypes([]);
  };

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Historie durchsuchen..."
          className="pl-10"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-10">
              <ListFilter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Nach Typ filtern</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableTypes.map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={selectedTypes.includes(type)}
                onCheckedChange={() => handleTypeSelectionChange(type)}
                onSelect={(e) => e.preventDefault()} // Prevent menu from closing on item click
              >
                {eventTypeTranslations[type] || type}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {isFiltered && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-10">
                <X className="mr-2 h-4 w-4" />
                Zurücksetzen
            </Button>
        )}
      </div>
    </div>
  );
}
