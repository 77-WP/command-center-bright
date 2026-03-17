import {
  LayoutDashboard,
  Users,
  BarChart3,
  PieChart,
  UtensilsCrossed,
  ImageIcon,
  TrendingUp,
  Activity,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navGroups = [
  {
    label: "Operations",
    items: [
      { title: "Live Orders", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "Customer CRM", url: "/customers", icon: Users },
      { title: "Sales Analytics", url: "/analytics", icon: BarChart3 },
      { title: "Product Analytics", url: "/product-analytics", icon: PieChart },
      { title: "Traffic & Funnel", url: "/traffic-analytics", icon: Activity },
    ],
  },
  {
    label: "Engine Room",
    items: [
      { title: "Menu Manager", url: "/menu", icon: UtensilsCrossed },
      { title: "Hero Banner", url: "/banners", icon: ImageIcon },
      { title: "Upsell Control", url: "/upsell", icon: TrendingUp },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="pt-4">
        {!collapsed && (
          <div className="px-4 pb-4">
            <h2 className="text-base font-bold text-foreground tracking-tight">Best Part</h2>
            <p className="text-xs text-muted-foreground">Command Center</p>
          </div>
        )}

        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                    >
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-accent"
                        activeClassName="bg-accent text-accent-foreground font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Separator className="mb-3" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && "Sign Out"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
