import { Navbar } from "./_components/navbar";
import { SimpleSearchDialog } from "@/components/modals/simple-search-dialog";

const BrowseFolderLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 px-15">{children}</main>
      <SimpleSearchDialog />

      {/* <Footer /> */}
    </div>
  );
};

export default BrowseFolderLayout;
