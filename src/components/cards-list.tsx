"use client";

import { cn } from "@/lib/utils";
import { CarouselCard } from "./carousels/carousel-card";
import { useEffect, useState } from "react";

interface CardsListProps {
  platform: string;
  freeTextSearchQuery?: string | null;
}

interface Site {
  id: string;
  appName?: string;
  appLogoUrl?: string;
  screenUrl?: string;
  fullpageScreenUrl?: string;
  [key: string]: any;
}

interface ApiResponse {
  sites: Site[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  hasMore: boolean;
  filterCriteria: any;
}

const GridCard = ({ children, platform }: { children: React.ReactNode; platform: string }) => {
  // Determine grid configuration based on platform
  const isMobile = platform.toLowerCase() === 'ios' || platform.toLowerCase() === 'android';
  const isWeb = platform.toLowerCase() === 'web';
  
  return (
    <div
      className={cn(
        "grid content-start gap-x-3 md:gap-x-6 gap-y-8 md:gap-y-10",
        // Dynamic grid columns based on platform
        isMobile 
          ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" // 4 cards max for mobile (iOS/Android)
          : isWeb 
            ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" // 3 cards max for web (landscape screenshots)
            : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7" // Default responsive
      )}
    >
      {children}
    </div>
  );
};

const AppsComponent = ({ sites, platform }: { sites: Site[]; platform: string }) => (
  <GridCard platform={platform}>
    {(sites || []).map((site, index) => (
      <CarouselCard key={site.id || index} site={site} platform={platform} />
    ))}
  </GridCard>
);

export function CardsList({ platform, freeTextSearchQuery=null }: CardsListProps) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSites = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/sites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            platform,
            pageSize: 100,
            pageIndex: 0,
            freeTextSearchQuery,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            errorText
          });
          throw new Error(`Failed to fetch sites: ${response.status} - ${errorText}`);
        }

        const data: ApiResponse = await response.json();
        
        // Ensure sites is always an array
        const sitesArray = Array.isArray(data.sites) ? data.sites : [];
        setSites(sitesArray);
      } catch (err) {
        console.error('Error fetching sites:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch sites');
        setSites([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchSites();
  }, [platform, freeTextSearchQuery]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Error loading sites: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <GridCard platform={platform}>
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="rounded-[28px] overflow-hidden w-full h-[680px] bg-muted animate-pulse" />
        ))}
      </GridCard>
    );
  }

  return <AppsComponent sites={sites} platform={platform} />;
}
