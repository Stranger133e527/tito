import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CardsSkeletonProps {
  count?: number;
  platform?: string;
}

const CardsSkeleton = ({ count = 10, platform = "mobile" }: CardsSkeletonProps) => {
  // Determine grid configuration based on platform
  const isMobile = platform.toLowerCase() === 'ios' || platform.toLowerCase() === 'android';
  const isWeb = platform.toLowerCase() === 'web';
  
  const gridConfig = isMobile 
    ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" // 4 cards max for mobile (iOS/Android)
    : isWeb 
      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" // 3 cards max for web (landscape screenshots)
      : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7"; // Default responsive

  // Determine aspect ratio based on platform
  const aspectRatioClass = isWeb ? 'aspect-[16/10]' : 'aspect-[9/16]'; // Landscape for web, portrait for mobile

  return (
    <div className={cn(
      "grid content-start gap-x-3 md:gap-x-6 gap-y-8 md:gap-y-10",
      gridConfig
    )}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="group relative flex flex-col gap-y-3 md:gap-y-4">
          {/* Mobile view - Single image skeleton */}
          <div className={cn(
            "rounded-[32px] overflow-hidden w-full h-auto md:hidden bg-muted flex items-center justify-center",
            aspectRatioClass
          )}>
            <Skeleton className="w-full h-full rounded-[32px]" />
          </div>

          {/* Desktop view - Carousel skeleton */}
          <div className="relative rounded-[28px] overflow-hidden w-full hidden md:block md:bg-foreground/[0.04] md:pt-6 md:pb-7">
            <div className="px-7">
              <div className={cn(
                "rounded-[32px] overflow-hidden max-h-[583px] bg-muted flex items-center justify-center",
                aspectRatioClass
              )}>
                <Skeleton className="w-full h-full rounded-[32px]" />
              </div>
            </div>

            {/* Carousel navigation skeleton */}
            <div className="absolute top-1/2 left-4 transform -translate-y-1/2">
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
            <div className="absolute top-1/2 right-4 transform -translate-y-1/2">
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>

            {/* Progress dots skeleton */}
            <div className="absolute z-10 bottom-3 left-1/2 transform -translate-x-1/2">
              <div className="flex gap-3">
                <Skeleton className="h-1.5 w-1.5 rounded-full" />
                <Skeleton className="h-1.5 w-1.5 rounded-full" />
                <Skeleton className="h-1.5 w-1.5 rounded-full" />
              </div>
            </div>
          </div>

          {/* Card info skeleton */}
          <div className="flex items-center gap-x-3 w-full">
            {/* App logo skeleton */}
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            
            {/* App info skeleton */}
            <div className="flex grow flex-col gap-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            
            {/* Action buttons skeleton */}
            <div className="hidden gap-x-2 group-focus-within:flex group-hover:flex">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CardsSkeleton; 