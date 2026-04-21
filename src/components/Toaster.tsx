import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from '@/lib/theme';

export function Toaster() {
  const { resolved } = useTheme();
  return (
    <SonnerToaster
      theme={resolved}
      richColors
      closeButton
      position="top-center"
      toastOptions={{
        style: {
          borderRadius: '14px',
          border: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
        },
        className: 'font-sans',
      }}
    />
  );
}
