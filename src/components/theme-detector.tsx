"use client"

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMounted } from '@/hooks/use-mounted';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Monitor, Moon, Sun, Palette, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { useTheme } from "next-themes";
import { useState, useEffect } from 'react';

export default function ThemeDetector() {
  const mounted = useMounted();
  const { theme, setTheme, systemTheme, themes } = useTheme();
  const [currentTheme, setCurrentTheme] = useState<string>('system');
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean | null>(null);
  
  const isDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const isLightMode = useMediaQuery("(prefers-color-scheme: light)");

  useEffect(() => {
    if (mounted) {
      setCurrentTheme(theme || 'system');
      setSystemPrefersDark(isDarkMode);
    }
  }, [mounted, theme, isDarkMode]);

  const getThemeStatus = () => {
    if (!mounted) return { status: 'loading', message: 'Detecting theme...', icon: <Info className="h-4 w-4" /> };
    
    switch (currentTheme) {
      case 'dark':
        return { 
          status: 'active', 
          message: 'Dark theme is active', 
          icon: <CheckCircle className="h-4 w-4 text-green-500" /> 
        };
      case 'light':
        return { 
          status: 'active', 
          message: 'Light theme is active', 
          icon: <CheckCircle className="h-4 w-4 text-green-500" /> 
        };
      case 'system':
        const systemMessage = systemPrefersDark 
          ? 'System theme is dark' 
          : 'System theme is light';
        return { 
          status: 'system', 
          message: systemMessage, 
          icon: <Monitor className="h-4 w-4 text-blue-500" /> 
        };
      default:
        return { 
          status: 'error', 
          message: 'Theme detection failed', 
          icon: <AlertCircle className="h-4 w-4 text-red-500" /> 
        };
    }
  };

  const getSystemInfo = () => {
    if (!mounted) return null;
    
    return {
      prefersDark: isDarkMode,
      prefersLight: isLightMode,
      systemTheme: systemTheme,
      availableThemes: themes,
      currentTheme: currentTheme
    };
  };

  const themeStatus = getThemeStatus();
  const systemInfo = getSystemInfo();

  if (!mounted) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme Detector
          </CardTitle>
          <CardDescription>Loading theme information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Theme Detector
        </CardTitle>
        <CardDescription>Current theme status and system preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Theme Status */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            {themeStatus.icon}
            <span className="font-medium">Current Theme</span>
          </div>
          <Badge variant={themeStatus.status === 'active' ? 'default' : 'secondary'}>
            {currentTheme}
          </Badge>
        </div>

        {/* Status Message */}
        <div className="text-sm text-muted-foreground">
          {themeStatus.message}
        </div>

        {/* System Information */}
        {systemInfo && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">System Information</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span>Prefers Dark:</span>
                <Badge variant={isDarkMode ? 'default' : 'outline'} className="text-xs">
                  {isDarkMode ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Prefers Light:</span>
                <Badge variant={isLightMode ? 'default' : 'outline'} className="text-xs">
                  {isLightMode ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>System Theme:</span>
                <Badge variant="outline" className="text-xs">
                  {systemTheme || 'Unknown'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Available Themes:</span>
                <Badge variant="outline" className="text-xs">
                  {themes.length}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Theme Controls */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Quick Actions</h4>
          <div className="flex gap-2">
            <Button
              variant={currentTheme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTheme("light");
                setCurrentTheme("light");
              }}
              className="flex-1"
            >
              <Sun className="h-4 w-4 mr-1" />
              Light
            </Button>
            <Button
              variant={currentTheme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTheme("dark");
                setCurrentTheme("dark");
              }}
              className="flex-1"
            >
              <Moon className="h-4 w-4 mr-1" />
              Dark
            </Button>
            <Button
              variant={currentTheme === "system" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTheme("system");
                setCurrentTheme("system");
              }}
              className="flex-1"
            >
              <Monitor className="h-4 w-4 mr-1" />
              System
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 