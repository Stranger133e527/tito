"use client"

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMounted } from '@/hooks/use-mounted';
import { Monitor, Moon, Sun, Palette } from 'lucide-react';
import { useTheme } from "next-themes";
import { useState, useEffect } from 'react';

export default function ThemeCheckHeader() {
  const mounted = useMounted();
  const { theme, setTheme, systemTheme } = useTheme();
  const [currentTheme, setCurrentTheme] = useState<string>('system');

  useEffect(() => {
    if (mounted) {
      setCurrentTheme(theme || 'system');
    }
  }, [mounted, theme]);

  const getThemeIcon = () => {
    if (!mounted) return <Palette className="h-4 w-4" />;
    
    switch (currentTheme) {
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'system':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Palette className="h-4 w-4" />;
    }
  };

  const getThemeLabel = () => {
    if (!mounted) return 'Theme';
    
    switch (currentTheme) {
      case 'dark':
        return 'Dark';
      case 'light':
        return 'Light';
      case 'system':
        return systemTheme === 'dark' ? 'System (Dark)' : 'System (Light)';
      default:
        return 'Theme';
    }
  };

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    setTheme(nextTheme);
    setCurrentTheme(nextTheme);
  };

  if (!mounted) {
    return (
      <div className="flex items-center space-x-2">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="w-16 h-4 rounded" />
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant="outline"
        size="sm"
        onClick={cycleTheme}
        className="flex items-center space-x-2"
      >
        {getThemeIcon()}
        <span className="hidden sm:inline">{getThemeLabel()}</span>
      </Button>
      
      <div className="flex space-x-1">
        <Button
          variant={currentTheme === "light" ? "default" : "outline"}
          size="icon"
          className="w-8 h-8"
          onClick={() => {
            setTheme("light");
            setCurrentTheme("light");
          }}
          title="Light theme"
        >
          <Sun className="h-4 w-4" />
        </Button>
        <Button
          variant={currentTheme === "dark" ? "default" : "outline"}
          size="icon"
          className="w-8 h-8"
          onClick={() => {
            setTheme("dark");
            setCurrentTheme("dark");
          }}
          title="Dark theme"
        >
          <Moon className="h-4 w-4" />
        </Button>
        <Button
          variant={currentTheme === "system" ? "default" : "outline"}
          size="icon"
          className="w-8 h-8"
          onClick={() => {
            setTheme("system");
            setCurrentTheme("system");
          }}
          title="System theme"
        >
          <Monitor className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 