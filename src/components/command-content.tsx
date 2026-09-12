"use client";

import { ScreensContent } from "@/components/hover-card-content";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useMediaQuery } from "@/hooks/use-media-query";
import { categoriesCommand, categoriesList } from "@/lib/_data";
import { cn } from "@/lib/utils";
import { HoverCardPortal } from "@radix-ui/react-hover-card";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

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

interface CommandCategoriesListProps {
  category: string;
  setCategory: React.Dispatch<React.SetStateAction<string>>;
}

export function CommandCategoriesList({
  category,
  setCategory,
}: CommandCategoriesListProps) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col items-stretch gap-y-1 pt-3 pb-5 md:flex">
      {categoriesCommand.map(({ key, label, icon }) => (
        <Button
          key={key}
          variant="ghost"
          className={cn(
            "flex items-center justify-start gap-x-3 py-2 pl-2 pr-3 h-14 focus-visible:ring-0",
            category === key ? "bg-accent" : ""
          )}
          onClick={() => setCategory(key)}
          tabIndex={-1}
        >
          <div className="flex justify-center items-center border size-10 rounded-xl bg-background">
            {icon}
          </div>
          {label}
        </Button>
      ))}
    </aside>
  );
}

export function Trending({ sites = [] }: { sites?: Site[] }) {
  return (
    <>
      <Apps sites={sites} />
      <Screens sites={sites} />
      <UiElements sites={sites} />
      <Flows sites={sites} />
      <TextInScreenshot />
    </>
  );
}

export function ItemsLines({ title, sites = [] }: { title: string; sites?: Site[] }) {
  // Extract unique categories from sites data
  const uniqueCategories = [...new Set(sites.map(site => site.appCategory))].slice(0, 10);
  
  return (
    <CommandGroup
      heading={title}
      className="!px-0 [&_[cmdk-group-heading]]:!px-4 [&_[cmdk-group-heading]]:!pb-0"
    >
      <div className="flex gap-0 w-full flex-wrap">
        {uniqueCategories.map((category, index) => (
          <CommandItem
            key={category}
            className="w-full cursor-pointer rounded-xl !px-4 !py-2 data-selected"
          >
            <span className="grow truncate text-base font-medium">
              {category}
            </span>
            <span className="text-sm text-muted-foreground">
              {sites.filter(site => site.appCategory === category).length}
            </span>
          </CommandItem>
        ))}
      </div>
    </CommandGroup>
  );
}

export function ItemsLinesHoverCard({ title, sites = [] }: { title: string; sites?: Site[] }) {
  const [selectedCat, setSelectedCat] = useState("");
  const prevDataValueRef = useRef<string | null>(null);
  const isLargeDesktop = useMediaQuery("(min-width: 1440px)");
  const customBoundary = document.querySelector("#hc-boundary");

  useEffect(() => {
    const handleMutation = (mutations: MutationRecord[]) => {
      mutations.forEach(() => {
        const selectedCommandItem = document.querySelector(
          ".command-item[data-selected=true]"
        );

        if (selectedCommandItem) {
          const dataValue = selectedCommandItem.getAttribute("data-value");

          if (dataValue && dataValue !== prevDataValueRef.current) {
            prevDataValueRef.current = dataValue;
            setSelectedCat(dataValue);
          }
        }
      });
    };

    const targetNodes = document.querySelectorAll(".command-item");
    const observer = new MutationObserver(handleMutation);
    const config = {
      attributes: true,
      attributeFilter: ["data-selected"],
      childList: false,
      subtree: false,
    };

    targetNodes.forEach((node) => {
      observer.observe(node, config);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Extract unique categories from sites data
  const uniqueCategories = [...new Set(sites.map(site => site.appCategory))].slice(0, 10);
  
  return (
    <CommandGroup
      heading={title}
      className="!px-0 [&_[cmdk-group-heading]]:!px-4 [&_[cmdk-group-heading]]:!pb-0"
    >
      <div className="flex gap-0 w-full flex-wrap">
        {uniqueCategories.map((category, index) => (
          <HoverCard
            openDelay={0}
            key={category}
            open={isLargeDesktop && selectedCat === category.toLowerCase()}
          >
            <HoverCardTrigger asChild>
              <CommandItem
                key={category}
                value={category}
                className={cn(
                  "w-full cursor-pointer rounded-xl !px-4 !py-2 command-item"
                )}
              >
                <span className="grow truncate text-base font-medium">
                  {category}
                </span>
                <span className="text-sm text-muted-foreground">
                  {(index + 1) * 19}
                </span>
              </CommandItem>
            </HoverCardTrigger>

            <HoverCardPortal>
              <HoverCardContent
                collisionPadding={8}
                collisionBoundary={customBoundary}
                align="start"
                side="right"
                sideOffset={20}
                className={cn(
                  "rounded-2xl border w-[--radix-hover-card-content-available-width] min-w-[296px] max-w-[400px]"
                )}
              >
                <ScreensContent name={category} />
              </HoverCardContent>
            </HoverCardPortal>
          </HoverCard>
        ))}
      </div>
    </CommandGroup>
  );
}

function Apps({ sites = [] }: { sites?: Site[] }) {
  return (
    <CommandGroup heading="Apps">
      <div className="flex flex-nowrap gap-x-2 [&_[cmdk-item]]:shrink-0">
        {sites.slice(0, 7).map((site, index) => (
          <CommandItem
            key={site.id}
            className="group !p-0 md:!bg-transparent rounded-t-2xl"
          >
            <div className="shrink-0 z-10 rounded-t-2xl overflow-hidden md:h-16">
              <div className="flex flex-col items-center gap-y-1 md:group-hover:-translate-y-5 md:group-data-selected:-translate-y-5 transition-transform duration-300 ease-out cursor-pointer">
                <div className="shrink-0 rounded-2xl overflow-hidden size-16 bg-muted flex items-center justify-center">
                  {site.appLogoUrl ? (
                    <Image
                      src={site.appLogoUrl}
                      alt={site.appName}
                      width={64}
                      height={64}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Logo</span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-center truncate font-normal text-muted-foreground">
                  {site.appName}
                </span>
              </div>
            </div>
          </CommandItem>
        ))}
      </div>
    </CommandGroup>
  );
}

function Screens({ sites = [] }: { sites?: Site[] }) {
  return (
    <CommandGroup heading="Screens">
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4 max-md:[&>*:nth-child(n+7)]:hidden md:[&>*:nth-child(3)]:col-span-2">
        {sites.slice(0, 7).map((site, index) => (
          <CommandItem
            key={site.id}
            className="group !p-0 !bg-transparent data-selected"
          >
            <div className="flex flex-col justify-between items-start p-3 bg-muted data-selected-bg rounded-2xl overflow-hidden size-full max-h-52 md:max-h-32 aspect-square cursor-pointer transition duration-300 ease-out">
              {site.screenUrl ? (
                <Image
                  src={site.screenUrl}
                  alt={`${site.appName} screen`}
                  width={site.metadata?.width || 200}
                  height={site.metadata?.height || 400}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span className="text-sm">{site.appName}</span>
              )}
              <Icons.bookmark className="size-9 ml-2 mb-3" />
            </div>
          </CommandItem>
        ))}
      </div>
    </CommandGroup>
  );
}

function UiElements({ sites = [] }: { sites?: Site[] }) {
  // Extract unique UI elements from all sites
  const allElements = sites.flatMap(site => site.screenElements).slice(0, 7);
  
  return (
    <CommandGroup heading="UI Elements">
      <div className="flex gap-2 w-full flex-wrap">
        {allElements.map((element, index) => (
          <CommandItem
            key={`${element}-${index}`}
            className="!p-0 !bg-transparent data-selected"
          >
            <Button
              variant="secondary"
              className="max-md:text-sm px-4 rounded-full data-selected-bg"
              tabIndex={-1}
            >
              {element}
            </Button>
          </CommandItem>
        ))}
      </div>
    </CommandGroup>
  );
}

function Flows({ sites = [] }: { sites?: Site[] }) {
  // Extract unique screen patterns from all sites
  const allPatterns = sites.flatMap(site => site.screenPatterns).slice(0, 4);
  
  return (
    <CommandGroup heading="Flows">
      <div className="grid grid-cols-3 md:grid-cols-4 max-md:[&>*:nth-child(n+4)]:hidden gap-x-2">
        {allPatterns.map((pattern, index) => (
          <CommandItem
            key={`${pattern}-${index}`}
            className="!p-0 !bg-transparent data-selected"
          >
            <div className="flex flex-col justify-between items-start p-3 bg-muted hover:bg-muted-foreground/30 data-selected-bg rounded-2xl overflow-hidden size-full max-h-52 aspect-square cursor-pointer transition duration-300 ease-out">
              <span className="text-sm">{pattern}</span>
              <Icons.bookmark className="size-9 ml-2 mb-3" />
            </div>
          </CommandItem>
        ))}
      </div>
    </CommandGroup>
  );
}

function TextInScreenshot() {
  return (
    <CommandGroup heading="Text In Screenshot">
      <div className="flex gap-2  w-full flex-wrap">
        {Array.from({ length: 5 }).map((_, index) => (
          <CommandItem
            key={index}
            className="!p-0 !bg-transparent data-selected"
          >
            <Button
              variant="secondary"
              className="max-md:text-sm px-4 rounded-full data-selected-bg"
              tabIndex={-1}
            >
              Screenshot {index}
            </Button>
          </CommandItem>
        ))}
      </div>
    </CommandGroup>
  );
}
