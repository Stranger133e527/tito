import { NavLinks } from "@/components/nav-links";
import { NavMenu } from "@/components/nav-menu";
import { SearchButtonNav } from "@/components/search-button-nav";
import { Button } from "@/components/ui/button";
import ThemeCheckHeader from "@/components/theme-check-header";
import Link from "next/link";

export function Navbar() {
  return (
    <header className="z-50 sticky top-0 flex h-[100px] border-b md:border-transparent md:h-[72px] bg-background w-full">
      <div className="w-full flex items-center justify-between px-4 md:px-6 lg:px-8">
        {/* Left side - Logo/Brand */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl">Open Mobbin</span>
          </Link>
        </div>

        {/* Center - Search Bar */}
        <div className="flex-1 flex justify-center max-w-md mx-4">
          <div className="w-full">
            <SearchButtonNav />
          </div>
        </div>

        {/* Right side - Menu and Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-row items-center gap-3">
            {/* <ThemeCheckHeader /> */}
          </div>
          <NavMenu />
        </div>
      </div>
    </header>
  );
}
