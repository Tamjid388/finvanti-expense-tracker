import type { ComponentType } from "react";

import { ArrowLeftRight, ChartColumn, CircleUser, LayoutDashboard, LogOut, Tags, Target, User, Wallet } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/config/routes";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Sidebar entries — mirrors the wireframe nav (docs/wireframes/web). */
const NAV_ITEMS: ReadonlyArray<{
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { to: ROUTES.dashboard, label: "Dashboard", icon: LayoutDashboard },
  { to: ROUTES.transactions, label: "Transactions", icon: ArrowLeftRight },
  { to: ROUTES.categories, label: "Categories", icon: Tags },
  { to: ROUTES.budgets, label: "Budgets", icon: Target },
  { to: ROUTES.reports, label: "Reports", icon: ChartColumn },
  { to: ROUTES.profile, label: "Profile", icon: User },
];

const ITEM_BASE = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none";

function AccountMenu() {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu">
          <CircleUser className="size-5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Placeholder session</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={ROUTES.profile}>Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled
          onClick={() => {
            // Real flow (once the API is wired): authApi.logout() → clearSession()
            // → queryClient.clear() → navigate(ROUTES.login). See features/auth.
            void navigate;
          }}
        >
          <LogOut className="size-4" aria-hidden />
          Sign out — connect API first
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* #3 keyboard skip link (PRD §10) */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:border focus:bg-background focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <div className="flex min-h-dvh">
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
          <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
            <Wallet className="size-5" aria-hidden />
            {APP_NAME}
          </div>
          <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 p-3">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === ROUTES.dashboard}
                className={({ isActive }) =>
                  cn(
                    ITEM_BASE,
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t p-3 text-xs text-muted-foreground">
            Placeholder build — API not connected
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b px-4">
            <span className="flex items-center gap-2 font-semibold md:hidden">
              <Wallet className="size-5" aria-hidden />
              {APP_NAME}
            </span>
            <AccountMenu />
          </header>

          {/* Mobile: horizontal scroll nav, wireframe-equivalent */}
          <nav
            aria-label="Primary — mobile"
            className="flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5 md:hidden"
          >
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === ROUTES.dashboard}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs outline-none",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>

          <main id="main" className="min-w-0 flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
