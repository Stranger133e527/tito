"use client";

import { useSearchModal } from "@/hooks/use-search-modal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icons } from "@/components/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";

const platforms = [
  { name: "iOS", value: "ios" },
  { name: "Android", value: "android" },
  { name: "Web", value: "web" },
];

export function SimpleSearchDialog() {
  const searchModal = useSearchModal();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("ios");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const url = `/browse/${selectedPlatform}?search=${encodeURIComponent(searchQuery.trim())}`;
      router.push(url);
      searchModal.onClose();
      setSearchQuery("");
    }
  };

  const selectedPlatformName = platforms.find(p => p.value === selectedPlatform)?.name || "iOS";

  return (
    <Dialog open={searchModal.isOpen} onOpenChange={searchModal.onClose}>
      <DialogContent className="sm:max-w-md top-[20%] translate-y-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.search className="h-4 w-4" />
            Search Apps
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-2 flex-1">
              <label htmlFor="search" className="text-sm font-medium">
                Search Query
              </label>
              <Input
                id="search"
                placeholder="Enter app name, category, or feature..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2 w-24">
              <label htmlFor="platform" className="text-sm font-medium">
                Platform
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-xs">
                    {selectedPlatformName}
                    <Icons.chevronRight className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-24">
                  {platforms.map((platform) => (
                    <DropdownMenuItem
                      key={platform.value}
                      onClick={() => setSelectedPlatform(platform.value)}
                      className="text-xs"
                    >
                      {platform.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={searchModal.onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!searchQuery.trim()}>
              Search
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 