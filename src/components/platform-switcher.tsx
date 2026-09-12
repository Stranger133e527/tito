"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";

const platforms = [
  { name: "iOS", path: "/browse/ios" },
  { name: "Web", path: "/browse/web" },
  { name: "Android", path: "/browse/android" },
];

export function PlatformSwitcher() {
  const params = useParams<{ platform: string; feature?: string }>();
  const currentPlatform = params.platform;

  return (
    <div className="flex items-center justify-center w-full py-6 border-b">
      <div className="flex bg-muted/50 rounded-xl p-1 shadow-sm">
        {platforms.map((platform) => {
          const isActive = currentPlatform === platform.name.toLowerCase();
          // Handle navigation with or without feature parameter
          const href = params.feature 
            ? `${platform.path}/${params.feature}`
            : platform.path;
          
          return (
            <Link
              key={platform.path}
              href={href}
              className={cn(
                "px-6 py-3 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap",
                isActive
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {platform.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
} 