import { HerosComponent } from "@/components/hero-switcher";
import { PlatformSwitcher } from "@/components/platform-switcher";

const BrowseLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <PlatformSwitcher />
      {children}
    </>
  );
};

export default BrowseLayout;
