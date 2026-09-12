import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface FlowSkeletonProps {
  count?: number;
  platformType?: 'web' | 'mobile' | 'ios' | 'android';
}

const FlowSkeleton = ({ count = 6, platformType = 'mobile' }: FlowSkeletonProps) => {
  const getGridConfig = (platformType: string) => {
    switch (platformType) {
      case 'web':
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
      case 'ios':
      case 'android':
      case 'mobile':
        return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
      default:
        return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";
    }
  };

  const getAspectRatioClass = (platformType: string) => {
    switch (platformType) {
      case 'web':
        return 'aspect-[16/10]';
      case 'ios':
      case 'android':
      case 'mobile':
        return 'aspect-[9/16]';
      default:
        return 'aspect-[9/16]';
    }
  };

  return (
    <div className="space-y-8">
      {/* Flow Header Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Flow Cards Grid */}
      <div className={cn(
        "grid content-start gap-x-3 md:gap-x-6 gap-y-8 md:gap-y-10",
        getGridConfig(platformType)
      )}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="group relative flex flex-col gap-y-3 md:gap-y-4">
            {/* Screen Image Skeleton */}
            <div className={cn(
              "relative rounded-[32px] overflow-hidden w-full bg-muted flex items-center justify-center",
              getAspectRatioClass(platformType)
            )}>
              <Skeleton className="w-full h-full rounded-[32px]" />
              
              {/* Step Badge Skeleton */}
              <div className="absolute bottom-2 left-2">
                <Skeleton className="h-6 w-16 rounded-lg" />
              </div>
              
              {/* Platform Badge Skeleton */}
              <div className="absolute top-2 left-2">
                <Skeleton className="h-6 w-12 rounded-lg" />
              </div>
            </div>

            {/* Card Info Skeleton */}
            <div className="flex items-center gap-x-3 w-full">
              <Skeleton className="h-10 w-10 rounded-xl" />
              
              <div className="flex grow flex-col gap-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              
              <Skeleton className="h-4 w-4" />
            </div>

            {/* Tags Skeleton */}
            <div className="flex flex-wrap gap-1">
              <Skeleton className="h-5 w-16 rounded-lg" />
              <Skeleton className="h-5 w-20 rounded-lg" />
              <Skeleton className="h-5 w-14 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlowSkeleton; 