'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  SidebarMenuBadge
} from '@/components/ui/sidebar';
import { UserNav } from '@/components/auth/user-nav';
import { Home, Car, Users, ClipboardList, Wrench, ShieldAlert, Calendar, Handshake, FileText, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardDataProvider, useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { GlobalSearch } from '@/components/search/global-search';
import { Badge } from '@/components/ui/badge';
import { MultitaskingProvider } from '@/components/multitasking/multitasking-context';
import { Taskbar } from '@/components/multitasking/taskbar';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

function SidebarTasksBadge() {
    const { kpis, isLoading } = useDashboardData();
    if (isLoading || kpis.myOpenTasksCount === 0) return null;
    return (
        <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] font-bold animate-in zoom-in duration-300">
            {kpis.myOpenTasksCount}
        </Badge>
    );
}

function SidebarNav() {
    const pathname = usePathname();
    return (
        <SidebarMenu>
            <SidebarMenuItem>
            <Link href="/dashboard">
                <SidebarMenuButton
                isActive={pathname === '/dashboard'}
                tooltip='Dashboard'
                >
                <Home />
                <span>Dashboard</span>
                </SidebarMenuButton>
            </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
            <Link href="/fahrzeuge">
                <SidebarMenuButton
                isActive={pathname.startsWith('/fahrzeuge')}
                tooltip='Fahrzeuge'
                >
                <Car />
                <span>Fahrzeuge</span>
                </SidebarMenuButton>
            </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
            <Link href="/vertraege">
                <SidebarMenuButton
                isActive={pathname.startsWith('/vertraege')}
                tooltip='Verträge'
                >
                <FileText />
                <span>Verträge</span>
                </SidebarMenuButton>
            </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
            <Link href="/dokumente">
                <SidebarMenuButton
                isActive={pathname.startsWith('/dokumente')}
                tooltip='Dokumente'
                >
                <FolderOpen />
                <span>Dokumente</span>
                </SidebarMenuButton>
            </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
            <Link href="/fahrzeuguebergabe">
                <SidebarMenuButton
                isActive={pathname.startsWith('/fahrzeuguebergabe')}
                tooltip='Fahrzeugübergabe'
                >
                <Handshake />
                <span>Fahrzeugübergabe</span>
                </SidebarMenuButton>
            </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
            <Link href="/kalender">
                <SidebarMenuButton
                isActive={pathname.startsWith('/kalender')}
                tooltip='Kalender'
                >
                <Calendar />
                <span>Kalender</span>
                </SidebarMenuButton>
            </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
            <Link href="/wartung">
                <SidebarMenuButton
                isActive={pathname.startsWith('/wartung')}
                tooltip='Wartung'
                >
                <Wrench />
                <span>Wartung/Service</span>
                </SidebarMenuButton>
            </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Link href="/schaeden">
                <SidebarMenuButton
                isActive={pathname.startsWith('/schaeden')}
                tooltip='Schäden'
                >
                <ShieldAlert />
                <span>Schäden</span>
                </SidebarMenuButton>
            </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Link href="/fahrer">
                <SidebarMenuButton
                isActive={pathname.startsWith('/fahrer')}
                    tooltip='Fahrer'
                >
                <Users />
                <span>Fahrer</span>
                </SidebarMenuButton>
            </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Link href="/aufgaben">
                <SidebarMenuButton
                isActive={pathname.startsWith('/aufgaben')}
                tooltip='Aufgaben'
                >
                <ClipboardList />
                <span>Aufgaben</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>
                    <SidebarTasksBadge />
                </SidebarMenuBadge>
            </Link>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  const appLogo = PlaceHolderImages.find(img => img.id === 'app-logo')?.imageUrl || 'https://picsum.photos/seed/bklogo/200/200';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const isPublicPath = pathname === '/debug-storage' || pathname === '/debug-server-upload';
    if (mounted && !isLoading && !session && !isPublicPath) {
      router.replace('/login');
    }
  }, [isLoading, session, router, mounted, pathname]);


  if (isLoading || (!session && pathname !== '/debug-storage' && pathname !== '/debug-server-upload')) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Lade...</p>
      </div>
    );
  }

  return (
    <DashboardDataProvider>
      <MultitaskingProvider>
        <SidebarProvider defaultOpen={false}>
            <Sidebar variant="sidebar" collapsible="icon">
            <SidebarHeader className="h-16 justify-center overflow-hidden border-b border-sidebar-border/50 px-0">
                <div className="flex items-center gap-3 px-4 w-full group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0 transition-all duration-300">
                    <div className="h-10 w-10 relative shrink-0 flex items-center justify-center">
                        <Image 
                            src={appLogo} 
                            alt="BK-Express Logo" 
                            fill 
                            className="object-contain"
                            data-ai-hint="company logo"
                        />
                    </div>
                    <div className="flex flex-col min-w-0 group-data-[state=collapsed]:hidden animate-in fade-in slide-in-from-left-2 duration-500">
                        <span className="font-black text-lg tracking-tighter leading-none">BK-Express</span>
                        <span className="text-[8px] uppercase font-bold tracking-[0.2em] text-muted-foreground/60 mt-0.5">Fleet System</span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarNav />
            </SidebarContent>
            <SidebarFooter className='mt-auto'>
                <UserNav />
            </SidebarFooter>
            </Sidebar>
            <SidebarInset className="flex flex-col h-svh overflow-hidden relative">
                {/* Header: Shrink-0 keeps it at the top */}
                <header className="shrink-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="flex h-16 items-center px-4 md:px-6 w-full gap-4">
                    <SidebarTrigger />
                    <div className='flex-1 flex justify-center md:justify-start'>
                        <GlobalSearch />
                    </div>
                    </div>
                </header>
                
                {/* Main: flex-1 and overflow-y-auto makes this the only scrolling part */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden relative bg-background">
                    <div className="mx-auto w-full max-w-screen-2xl p-4 md:p-8 pb-12">
                        {children}
                    </div>
                </main>
                
                {/* Taskbar: Shrink-0 keeps it at the bottom, flex flow ensures no overlap */}
                <div className="shrink-0 z-40">
                    <Taskbar />
                </div>
            </SidebarInset>
        </SidebarProvider>
      </MultitaskingProvider>
    </DashboardDataProvider>
  );
}
