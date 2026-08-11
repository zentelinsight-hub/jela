import { useRouter } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';

import { AppHeader } from '@/components/app-header';
import { AppScreen } from '@/components/app-screen';

export function PageScreen({
  title,
  subtitle,
  children,
  scroll = true,
  padded = true,
  action,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  scroll?: boolean;
  padded?: boolean;
  action?: ReactNode;
}>) {
  const router = useRouter();
  return (
    <AppScreen
      scroll={scroll}
      padded={padded}
      header={<AppHeader title={title} subtitle={subtitle} onBack={() => router.back()} action={action} />}
    >
      {children}
    </AppScreen>
  );
}
