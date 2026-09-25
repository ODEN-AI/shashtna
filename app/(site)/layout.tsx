import { CustomerBottomNav } from "@/app/components/site/CustomerBottomNav";
import { SiteFooter } from "@/app/components/site/SiteFooter";
import { SiteHeader } from "@/app/components/site/SiteHeader";
import { getSessionUser } from "@/src/server/auth";

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser().catch(() => null);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <SiteHeader user={user ? { name: user.name, isStaff: user.isStaff } : null} />
      <main id="main" className={user ? "flex-1 pb-safe lg:pb-0" : "flex-1"}>
        {children}
      </main>
      <SiteFooter />
      {user ? <CustomerBottomNav /> : null}
    </div>
  );
}
