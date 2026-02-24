import { Sidebar } from "./_components/sidebar";
import { SupabaseHydration } from "./_components/SupabaseHydration";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <SupabaseHydration />
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
