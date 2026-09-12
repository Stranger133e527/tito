"use client";

import { ContextMenuCard } from "@/components/context-menu-card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import React from "react";

import Image from "next/image";

import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

interface Site {
  id: string;
  appName?: string;
  appTagline?: string;
  platform?: string;
  is_finance_plus?: boolean;
  appLogoUrl?: string;
  screenUrl?: string;
  fullpageScreenUrl?: string;
  previewScreens?: Array<{ id: string; screenUrl: string }>;
  appVersionId?: string;
  [key: string]: unknown;
}

// Screen Modal Component
function ScreenModal({ 
  site, 
  platform, 
  isOpen, 
  onClose 
}: { 
  site?: Site; 
  platform?: string; 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const [isCopying, setIsCopying] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  if (!isOpen || !site) return null;

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
  };

  const copyImage = async () => {
    setIsCopying(true);
    try {
      if (!site.screenUrl) {
        toast.error("No image URL available");
        return
      }

      // Strategy 1: Direct fetch and clipboard write
      try {
        if (navigator.clipboard && navigator.clipboard.write) {
          const response = await fetch(site.screenUrl, {
            mode: 'cors',
            credentials: 'omit'
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
          }

          const blob = await response.blob();
          const clipboardItem = new ClipboardItem({
            [blob.type]: blob
          });
          
          await navigator.clipboard.write([clipboardItem]);
          toast.success("Image copied to clipboard!");
          return;
        }
      } catch (directError) {
        console.log("Direct copy failed, trying fallback:", directError);
      }

      // Strategy 2: Canvas-based approach
      try {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = site.screenUrl || '';
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error("Canvas context not available");
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
          }, 'image/png');
        });
        
        const clipboardItem = new ClipboardItem({
          [blob.type]: blob
        });
        
        await navigator.clipboard.write([clipboardItem]);
        toast.success("Image copied to clipboard!");
        return;
        
      } catch (canvasError) {
        console.log("Canvas copy failed, trying URL fallback:", canvasError);
      }

      // Strategy 3: Copy image URL as text
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(site.screenUrl);
          toast.success("Image URL copied to clipboard instead");
          return;
        }
      } catch (urlError) {
        console.log("URL copy failed:", urlError);
      }

      toast.error("Could not copy image. Please try right-clicking and copying manually.");
      
    } catch (error) {
      console.error("All copy strategies failed:", error);
      toast.error("Failed to copy image. Please try again.");
    } finally {
      setIsCopying(false);
    }
  };

  const downloadImage = async () => {
    try {
      if (!site.screenUrl) {
        toast.error("No image URL available");
        return;
      }

      const response = await fetch(site.screenUrl, {
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${site.appName || 'screen'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("Image downloaded successfully!");
    } catch (error) {
      console.error("Failed to download image:", error);
      toast.error("Failed to download image. Please try again.");
    }
  };

  // Determine aspect ratio based on platform
  const isWeb = platform?.toLowerCase() === 'web';
  const aspectRatioClass = isWeb ? 'aspect-[16/10]' : 'aspect-[9/16]';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in-0 duration-300">
      <div className="w-full max-w-7xl max-h-[95vh] bg-black border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-300 rounded-2xl">
        {/* Header */}
        <div className="border-b border-zinc-800 bg-zinc-950/50 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Icons.help className="w-5 h-5 text-zinc-400" />
                <span className="text-lg font-semibold">{site.appName || "App Screen"}</span>
              </div>
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-200 border-zinc-700">
                {platform || "Mobile"}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <Icons.close className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex h-[calc(95vh-80px)]">
          {/* Left side - Large image */}
          <div className="flex-1 p-8 flex flex-col items-center justify-center bg-zinc-950 relative">
            {/* Action buttons above image */}
            <div className="mb-4 flex justify-end w-full max-w-full gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadImage}
                className="bg-black/80 hover:bg-black text-white border border-zinc-600 rounded-lg px-4 py-2 backdrop-blur-sm transition-all hover:scale-105 shadow-lg flex items-center gap-2"
              >
                <Icons.download className="w-4 h-4" />
                <span className="text-sm font-medium">Download</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyImage}
                className="bg-black/80 hover:bg-black text-white border border-zinc-600 rounded-lg px-4 py-2 backdrop-blur-sm transition-all hover:scale-105 shadow-lg flex items-center gap-2"
                disabled={isCopying}
              >
                {isCopying ? (
                  <Icons.spinner className="animate-spin h-4 w-4 text-white" />
                ) : (
                  <>
                    <Icons.copy className="w-4 h-4" />
                    <span className="text-sm font-medium">Copy Image</span>
                  </>
                )}
              </Button>
            </div>
            
            <div className="relative max-w-full max-h-full">
              <div className="relative">
                {imageLoading && (
                  <div className={cn("max-w-full max-h-[70vh] rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden", aspectRatioClass)}>
                    <div className="w-full h-full bg-zinc-800 animate-pulse" />
                  </div>
                )}
                <img
                  src={site.screenUrl || "/placeholder.svg"}
                  alt={site.appName || "App screen"}
                  className={cn(
                    "max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl border border-zinc-800 transition-opacity duration-300",
                    aspectRatioClass,
                    imageLoading ? "opacity-0 absolute inset-0" : "opacity-100"
                  )}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
              </div>
            </div>
          </div>

          {/* Right side - Details */}
          <div className="w-96 border-l border-zinc-800 bg-zinc-950">
            <div className="p-6 space-y-6">
              {/* App info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-white text-lg">App Details</h3>
                <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                  <div className="shrink-0 h-10 w-10 bg-[#eaeaea] rounded-xl overflow-hidden flex items-center justify-center">
                    {site.appLogoUrl && (
                      <Image
                        src={site.appLogoUrl}
                        alt={site.appName || "App logo"}
                        width={40}
                        height={40}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{site.appName || "App Name"}</p>
                    <p className="text-xs text-zinc-400 capitalize">{platform || "Mobile"}</p>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="space-y-3">
                <h4 className="font-medium text-white">Quick Actions</h4>
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    className="justify-start bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
                    asChild
                  >
                    <Link href={`/sites/${site.appVersionId}?platform=${site.platform || platform || 'ios'}`}>
                      <Icons.arrowUpRight className="w-4 h-4 mr-2" />
                      View All Screens
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("Link copied to clipboard!");
                    }}
                  >
                    <Icons.link className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CarouselCard({ site, platform }: { site?: Site; platform?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [scrollPrev, setScrollPrev] = React.useState<boolean>(false);
  const [scrollNext, setScrollNext] = React.useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState(false);
  const searchParams = useSearchParams();

  // Check for search parameter to auto-open modal
  useEffect(() => {
    const screenParam = searchParams.get('screen');
    if (screenParam && site?.appVersionId === screenParam) {
      setModalOpen(true);
    }
  }, [searchParams, site?.appVersionId]);

  // Determine aspect ratio based on platform
  const isWeb = platform?.toLowerCase() === 'web';
  const aspectRatioClass = isWeb ? 'aspect-[16/10]' : 'aspect-[9/16]'; // Landscape for web, portrait for mobile
  const previewScreens = site?.previewScreens?.length
    ? site.previewScreens
    : site?.screenUrl
      ? [{ id: site.id, screenUrl: site.screenUrl }]
      : [];

  React.useEffect(() => {
    if (!api) {
      return;
    }

    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });

    api.on("select", () => {
      setScrollPrev(api.canScrollPrev());
      setScrollNext(api.canScrollNext());
    });
  }, [api]);

  const handleScreenClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  };

  return (
    <>
    <ContextMenuCard>
      <div className="group relative flex flex-col gap-y-3 md:gap-y-4">
          {/* Mobile view - Single image with click handler */}
          <div className={cn("rounded-[32px] overflow-hidden w-full h-auto md:hidden bg-muted flex items-center justify-center cursor-pointer", aspectRatioClass)} onClick={handleScreenClick}>
            {site?.screenUrl ? (
              <Image
                src={site.screenUrl}
                alt={site.appName || "App screen"}
                width={300}
                height={533}
                className="w-full h-full object-contain rounded-[32px]"
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              />
            ) : (
              <span className="text-muted-foreground">{isWeb ? "Website Screen" : "Phone Screen"}</span>
            )}
          </div>

          {/* Desktop view - Carousel */}
        <div className="relative rounded-[28px] overflow-hidden w-full hidden md:block md:bg-foreground/[0.04] md:group-hover:bg-foreground/[0.06] transition duration-300 md:pt-6 md:pb-7">
          <Carousel
            setApi={setApi}
            className="m-0"
            opts={{
              align: "end",
              duration: 20,
            }}
          >
            <CarouselContent className="m-0">
              {previewScreens.length ? (
                previewScreens.map((screen) => (
                <CarouselItem key={screen.id} className="px-7">
                    <div className="cursor-pointer" onClick={handleScreenClick}>
                    <Image
                      src={screen.screenUrl}
                      alt={site?.appName || "App screen"}
                      width={300}
                      height={533}
                      className="w-full h-full object-contain rounded-[32px] "
                      style={{ maxWidth: '100%', maxHeight: '100%' }}
                    />
                    </div>
                </CarouselItem>
                ))
              ) : (
                Array.from({ length: 3 }).map((_, index) => (
                  <CarouselItem key={index} className="px-7">
                      <div className={cn("rounded-[32px] overflow-hidden max-h-[583px] bg-muted flex items-center justify-center cursor-pointer", aspectRatioClass)} onClick={handleScreenClick}>
                    <span className="text-muted-foreground">{isWeb ? `Website Screen ${index + 1}` : `Phone Screen ${index + 1}`}</span>
                  </div>
                  </CarouselItem>
                ))
              )}
            </CarouselContent>
            <CarouselPrevious
              variant="ghost"
              className={cn(
                "invisible group-hover:visible ml-14 rounded-xl size-10 bg-background z-50",
                scrollPrev ? "" : "hidden"
              )}
            />
            <CarouselNext
              variant="ghost"
              className={cn(
                "invisible group-hover:visible mr-14 rounded-xl size-10 bg-background z-50",
                scrollNext ? "" : "hidden"
              )}
            />
          </Carousel>

          <div className="absolute z-10 bottom-3 left-1/2 transform -translate-x-1/2 invisible group-hover:visible">
            <div className="flex gap-3">
              {previewScreens.length ? (
                previewScreens.map((screen, index) => (
                <button key={screen.id} className="relative size-1.5 overflow-hidden rounded-full">
                  <div className="w-full h-full bg-muted-foreground/30 dark:bg-muted-foreground/70 absolute"></div>
                  <div className={cn("h-full bg-primary relative z-10", current === index + 1 ? "w-full" : "w-0")} />
                </button>
                ))
              ) : (
                Array.from({ length: 3 }).map((_, index) => (
                  <button
                    key={index}
                    className="relative size-1.5 overflow-hidden rounded-full"
                  >
                    <div className="w-full h-full bg-muted-foreground/30 dark:bg-muted-foreground/70 absolute"></div>
                    <div
                      className={cn(
                        "h-full bg-primary relative w-0 z-10",
                        current === index + 1 ? "w-full" : ""
                      )}
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <Link href={`/sites/${site?.appVersionId}?platform=${site?.platform || platform || 'ios'}`} className="block">
          <div className="flex items-center gap-x-3 w-full cursor-pointer">
            <div className="shrink-0 h-10 w-10 bg-[#eaeaea] rounded-xl overflow-hidden flex items-center justify-center">
            {site?.appLogoUrl && (
              <Image
                src={site.appLogoUrl}
                alt={site.appName || "App logo"}
                width={40}
                height={40}
                className="w-full h-full object-contain"
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              />
            )}
          </div>

          <div className="flex grow flex-col">
            <span className="line-clamp-1 text-body-medium-bold underline decoration-transparent group-hover:decoration-current transition-colors ease-out">
              {site?.appName || "App Name"}
            </span>
            <span className="line-clamp-1 text-sm text-muted-foreground font-normal">
              {site?.appTagline || (site?.appName ? `${site.appName} screens` : "App screens")}
            </span>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="uppercase">{site?.platform || platform || 'mobile'}</span>
              <span aria-hidden="true">•</span>
              <span>{previewScreens.length} preview screens</span>
              {site?.is_finance_plus && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Finance+</Badge>
              )}
            </div>
          </div>

          <div
            className={cn(
              "hidden gap-x-2 group-focus-within:flex group-hover:flex transition ease-out",
              menuOpen ? "flex" : "hidden"
            )}
          >
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className="rounded-xl z-50"
                    onClick={() => alert("Saved!!")}
                  >
                    <Icons.bookmark className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent
                    sideOffset={10}
                    className="rounded-lg text-xs"
                  >
                    <p>Save to collections</p>
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>

              <Tooltip>
                <DropdownMenu
                  open={menuOpen}
                  onOpenChange={() => setMenuOpen(!menuOpen)}
                >
                  <DropdownMenuTrigger asChild>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="rounded-xl z-50"
                      >
                        <Icons.options className="size-5" />
                      </Button>
                    </TooltipTrigger>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link
                        className="flex justify-start items-center gap-x-2"
                        href={`/sites/${site?.appVersionId}?platform=${site?.platform || platform || 'ios'}`}
                      >
                        <Icons.download className="size-5" />
                        <span>Download all screens</span>
                        <Badge className="px-2 font-medium uppercase border-none">
                          PRO
                        </Badge>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        className="flex justify-start items-center gap-x-2"
                        href={`/sites/${site?.appVersionId}?platform=${site?.platform || platform || 'ios'}`}
                      >
                        <Icons.link className="size-5" />
                        <span>Copy link app</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <TooltipPortal>
                  <TooltipContent
                    sideOffset={10}
                    className="rounded-lg text-xs"
                  >
                    <p>Download & Share</p>
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        </Link>
      </div>
    </ContextMenuCard>

      {/* Screen Modal */}
      <ScreenModal 
        site={site} 
        platform={platform} 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </>
  );
}
