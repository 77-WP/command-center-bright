import { LayoutDashboard, Users, BarChart3, UtensilsCrossed, MoreHorizontal } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";

const bottomNavItems = [
  { title: "Live Orders", url: "/", icon: LayoutDashboard },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Menu", url: "/menu", icon: UtensilsCrossed },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border safe-area-inset-bottom">
      <div className="flex items-stretch" style={{ minHeight: "56px", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] text-xs transition-colors ${
              isActive(item.url) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="leading-none">{item.title}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setOpenMobile(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] text-xs text-muted-foreground transition-colors"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="leading-none">More</span>
        </button>
      </div>
    </nav>
  );
}
