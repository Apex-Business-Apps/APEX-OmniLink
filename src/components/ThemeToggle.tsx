import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-9 w-[280px] rounded-xl bg-muted/50 animate-pulse" />
    );
  }

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div 
      className="inline-flex h-10 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground"
      role="tablist"
      aria-label="Theme selection"
      data-testid="theme-toggle"
    >
      <button
        type="button"
        role="tab"
        aria-selected={!isDark}
        aria-controls="theme-white-fortress"
        data-testid="theme-toggle-white-fortress"
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          !isDark ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50"
        )}
        onClick={() => setTheme('light')}
      >
        <Sun className="mr-2 h-4 w-4" />
        White Fortress
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isDark}
        aria-controls="theme-night-watch"
        data-testid="theme-toggle-night-watch"
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          isDark ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50"
        )}
        onClick={() => setTheme('dark')}
      >
        <Moon className="mr-2 h-4 w-4" />
        Night Watch
      </button>
    </div>
  );
}
