import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(next)}
      title={`Theme: ${theme}. Click for ${next}.`}
      className={cn('rounded-full')}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
