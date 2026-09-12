"use client";

import { useSearchModal } from "@/hooks/use-search-modal";
import { cn } from "@/lib/utils";

import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  CommandCategoriesList,
  ItemsLines,
  ItemsLinesHoverCard,
  Trending,
} from "@/components/command-content";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { categoriesCommand } from "@/lib/_data";
import React, { useEffect, useState } from "react";

// Site interface to match the API response
interface Site {
  id: string;
  appId: string;
  appName: string;
  appCategory: string;
  appLogoUrl: string;
  appTagline: string;
  platform: string;
  screenUrl: string;
  fullpageScreenUrl: string | null;
  screenElements: string[];
  screenPatterns: string[];
  metadata: {
    width: number;
    height: number;
    boundingBoxes: any[];
  };
  popularityMetric: number;
  trendingMetric: number;
}

export function SearchCommandDialog() {
  const searchModal = useSearchModal();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("trending");
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch sites data
  const fetchSites = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterOperator: 'or',
          appCategories: [],
          screenElements: [],
          screenPatterns: [],
          isSubsequentRequest: false,
          pageIndex: 0,
          pageSize: 20,
          sortBy: 'popularity'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSites(data.sites || []);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        searchModal.onOpen();
      }

      if (searchModal.isOpen) {
        if (e.key === "Tab") {
          e.preventDefault();
          const currentIndex = categoriesCommand.findIndex(
            (item) => item.key === category
          );
          const nextIndex = (currentIndex + 1) % categoriesCommand.length;
          setCategory(categoriesCommand[nextIndex].key);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [searchModal, category]);

  // Fetch sites when modal opens
  useEffect(() => {
    if (searchModal.isOpen && sites.length === 0) {
      fetchSites();
    }
  }, [searchModal.isOpen]);

  return (
    <CommandDialog
      open={searchModal.isOpen}
      onOpenChange={searchModal.onClose}
      className={cn(
        "max-w-full h-full md:max-h-[calc(100vh-8px)] md:h-[720px] sm:max-w-[816px] !rounded-none md:!rounded-3xl md:top-0 md:!translate-y-0",
        "data-[state=closed]:max-md:!slide-out-to-bottom-5 data-[state=open]:max-md:!slide-in-from-bottom-5",
        "data-[state=closed]:max-md:!zoom-out-100 data-[state=open]:max-md:!zoom-in-100",
        "search-command pt-1.5 md:pt-3"
      )}
    >
      <div className="flex items-center gap-x-0 w-full [&_[cmdk-input-wrapper]]:flex [&_[cmdk-input-wrapper]]:grow">
        <CommandInput
          placeholder="Search on iOS..."
          autoFocus
          value={search}
          onValueChange={setSearch}
          className="!h-10 md:!h-12"
        />

        <Button
          variant="ghost"
          className="block md:hidden hover:!bg-transparent pl-0"
          onClick={searchModal.onClose}
        >
          Cancel
        </Button>
      </div>

      <section className="flex pl-3 pt-2 size-full overflow-hidden">
        {!search ? (
          <>
            <CommandCategoriesList
              category={category}
              setCategory={setCategory}
            />

            <ScrollArea className="w-full">
              <CommandList className="relative size-full !max-h-none pr-2 md:px-3 pb-10">
                {category === "trending" && (
                  <>
                    <CommandItem className="absolute inset-0 z-0 !bg-transparent !text-transparent">
                      hidden item
                    </CommandItem>
                    <Trending sites={sites} />
                  </>
                )}

                {category === "screens" && (
                  <ItemsLinesHoverCard title="Screens -- Hover Card" sites={sites} />
                )}

                {category === "ui-elements" && (
                  <ItemsLinesHoverCard title="UI Elements -- Hover Card" sites={sites} />
                )}

                {category === "flows" && (
                  <ItemsLines title="Flows -- NOT Hover Card" sites={sites} />
                )}
              </CommandList>
            </ScrollArea>
          </>
        ) : (
          <>
            <span>search list</span>
            <CommandEmpty>No results found.</CommandEmpty>
          </>
        )}
      </section>
    </CommandDialog>
  );
}
