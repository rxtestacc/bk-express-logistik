'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSession } from '@/hooks/use-session';
import { useRouter } from 'next/navigation';
import { useSidebar } from '../ui/sidebar';
import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @fileoverview User navigation component for the sidebar footer.
 * Provides user information and a prominent logout button.
 */

export function UserNav() {
  const { session, setSession } = useSession();
  const router = useRouter();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const handleLogout = () => {
    // Clear session state
    setSession(null);
    // Use window.location for a clean redirect and state reset to ensure full logout
    window.location.href = '/login';
  };

  if (!session) {
    return null;
  }

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  if (isCollapsed) {
    return (
       <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hover:bg-primary/10">
            <Avatar className="h-9 w-9 border-2 border-primary/10">
              <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                {getInitials(session.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" side="right" sideOffset={12}>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-bold leading-none">{session.name}</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-1 uppercase tracking-wider">{session.role}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer font-bold py-2.5">
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full p-1">
      {/* User Info Card */}
      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 border border-border/40 shadow-sm">
        <Avatar className="h-9 w-9 border-2 border-white shadow-sm shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-black">
            {getInitials(session.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-xs font-black truncate leading-tight">{session.name}</p>
          <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-bold mt-0.5 truncate">{session.role}</p>
        </div>
      </div>
      
      {/* Prominent Red Logout Button */}
      <Button 
        variant="ghost" 
        onClick={handleLogout}
        className={cn(
            "w-full justify-start h-10 px-2 rounded-lg transition-all duration-200",
            "text-destructive hover:text-white hover:bg-destructive",
            "border border-destructive/10 hover:border-destructive shadow-sm"
        )}
      >
        <div className="flex items-center justify-center h-7 w-7 rounded-md bg-destructive/10 text-destructive group-hover:bg-white/20 mr-2 shrink-0">
            <LogOut className="h-3.5 w-3.5" />
        </div>
        <span className="font-bold text-xs uppercase tracking-widest">Abmelden</span>
      </Button>
    </div>
  );
}
