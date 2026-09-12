import { CardsList } from "@/components/cards-list";
import { TagsList } from "@/components/tags-list";
import CardsSkeleton from "@/components/cards-skeleton";
import { Suspense } from "react";

interface PlatformPageProps {
  params: Promise<{
    platform: string;
  }>;
  searchParams: Promise<{
    search?: string;
  }>;
}

export default async function PlatformPage({ params, searchParams }: PlatformPageProps) {
  const { platform } = await params;
  const { search } = await searchParams;

  if(platform !=="ios" && platform !=="android" && platform !=="web") {
    return <div>Invalid platform</div>;
  }
  
  return (
    <div className="flex flex-col gap-y-6">
      {/* <TagsList /> */}

      <div className="h-[900px]">
        <Suspense fallback={<CardsSkeleton count={12} platform={platform} />}>
          <CardsList platform={platform} freeTextSearchQuery={search} />
        </Suspense>
      </div>
    </div>
  );
}
