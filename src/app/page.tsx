'use client';
import { useSession } from '@/hooks/use-session';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const { session, isLoading } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || isLoading) {
      return;
    }
    if (!session) {
      router.replace('/login');
    } else {
      router.replace('/dashboard');
    }
  }, [session, isLoading, router, mounted]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <p className="text-muted-foreground">Lade...</p>
    </main>
  );
}
