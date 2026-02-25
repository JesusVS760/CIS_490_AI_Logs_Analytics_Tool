import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Upload,
  Settings,
  LogOut,
  CircleUserIcon,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Upload", icon: Upload, href: "/upload" },
  { title: "Settings", icon: Settings, href: "/settings" },
  { title: "Logout", icon: LogOut, href: "/logout" },
];

export function AppSidebar() {
  return (
    <Sidebar collapsible="offcanvas" className="relative z-10 h-full">
      <SidebarHeader className="px-4 py-3 text-lg font-semibold flex flex-row items-center justify-start">
        {/*Future Update: dynamically render a user*/}
        <CircleUserIcon size={20} />
        <p>User</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 py-3 text-sm text-muted-foreground">
        v1.0.0
      </SidebarFooter>
    </Sidebar>
  );
}
