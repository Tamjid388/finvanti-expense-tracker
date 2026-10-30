import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ArrowLeftRight, ChartColumn, CircleUser, Ellipsis, LogOut, NotebookPen, Search, Tags, Target, User, LayoutDashboard } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/config/routes";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useMonthParam } from "@/hooks/use-month-param";
import { useMe, useLogout } from "@/features/auth/hooks/use-auth";
import { useTransactions } from "@/features/transactions/hooks/use-transactions";
import { useBudgets } from "@/features/budgets/hooks/use-budgets";
import { Toaster } from "@/components/shared/Toaster";
import { Money } from "@/components/shared/Money";

/** Sidebar entries — mirrors the wireframe nav (docs/wireframes/web). */
const NAV_ITEMS: ReadonlyArray<{
  to: string;
  label: string;
  /** Compact label for the mobile tab bar (wireframe mobile copy). */
  short: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { to: ROUTES.dashboard, label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { to: ROUTES.transactions, label: "Transactions", short: "Txns", icon: ArrowLeftRight },
  { to: ROUTES.categories, label: "Categories", short: "Cats", icon: Tags },
  { to: ROUTES.notes, label: "Notes", short: "Notes", icon: NotebookPen },
  { to: ROUTES.budgets, label: "Budgets", short: "Budgets", icon: Target },
  { to: ROUTES.reports, label: "Reports", short: "Reports", icon: ChartColumn },
  { to: ROUTES.profile, label: "Profile", short: "Profile", icon: User },
];

const ITEM_BASE = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none";

/** Wireframe `user-card`: identity + logout. */
function UserCard() {
  const me = useMe();
  const logout = useLogout();
  const initial = (me.data?.username || me.data?.email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center gap-2 border-t border-white/10 p-3">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
        aria-hidden
      >
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">
          {me.data?.username ?? "…"}
        </span>
        <span className="block truncate text-xs text-slate-400">{me.data?.email ?? ""}</span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Log out"
        title="Log out"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
        className="shrink-0 text-slate-400 hover:bg-white/10 hover:text-white"
      >
        <LogOut className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

/** Wireframe `side-card`: overall budget for the selected month, live. */
function OverallBudgetCard({ month, label }: { month: string; label: string }) {
  const budgets = useBudgets({ month });
  const overall = (budgets.data ?? []).find((b) => b.category == null);

  return (
    <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-medium text-slate-300">Overall budget · {label}</p>
      {budgets.isPending ? (
        <p className="mt-1 text-xs text-slate-500">Loading…</p>
      ) : overall ? (
        <>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-label="Overall budget progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              Number(overall.limit_amount) > 0
                ? Math.min(100, (Number(overall.spent) / Number(overall.limit_amount)) * 100)
                : 0,
            )}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              style={{
                width: `${
                  Number(overall.limit_amount) > 0
                    ? Math.min(100, (Number(overall.spent) / Number(overall.limit_amount)) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400 tabular-nums">
            <Money amount={overall.spent} /> / <Money amount={overall.limit_amount} />
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-auto p-0 text-xs text-slate-300 hover:bg-transparent hover:text-white"
            asChild
          >
            <Link to={`${ROUTES.budgets}?month=${month}`}>View budgets</Link>
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-auto p-0 text-xs text-slate-300 hover:bg-transparent hover:text-white"
          asChild
        >
          <Link to={`${ROUTES.budgets}?month=${month}`}>Set an overall budget →</Link>
        </Button>
      )}
    </div>
  );
}

function AccountMenu({
  avatarClassName,
  triggerClassName,
  fallbackIconClassName,
}: {
  avatarClassName?: string;
  triggerClassName?: string;
  fallbackIconClassName?: string;
}) {
  const me = useMe();
  const logout = useLogout();
  const initial = (me.data?.username || me.data?.email || "?").slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" className={triggerClassName}>
          {me.data ? (
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground",
                avatarClassName,
              )}
              aria-hidden
            >
              {initial}
            </span>
          ) : (
            <CircleUser className={cn("size-5", fallbackIconClassName)} aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">
          {me.data ? `${me.data.username} · ${me.data.email}` : "Account"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={ROUTES.profile}>Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={logout.isPending} onClick={() => logout.mutate()}>
          <LogOut className="size-4" aria-hidden />
          {logout.isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Topbar: global search + quick-add. Month picking lives on each page. */
function Topbar() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  useEffect(() => {
    setQuery(params.get("q") ?? "");
  }, [params]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `${ROUTES.transactions}?q=${encodeURIComponent(q)}` : ROUTES.transactions);
  }

  return (
    <header className="sticky top-0 z-10 hidden border-b bg-background/90 backdrop-blur md:block">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <form
          onSubmit={submitSearch}
          role="search"
          className="relative hidden min-w-40 flex-1 md:block"
        >
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search description, category…"
            aria-label="Search transactions"
            className="pl-8"
          />
        </form>

        <div className="flex w-full flex-wrap items-center justify-center gap-1.5 sm:w-auto">
          <div className="hidden md:block">
            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

/** Wireframe mobile `tabbar` (docs/wireframes/mobile): fixed bottom tab nav
 * so primary navigation stays reachable on small screens without
 * horizontal scrolling. Five slots: Home, Categories, center Transactions
 * FAB, Budgets, and a More menu (Reports/Notes/Profile). */
function MobileSideTab({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium outline-none",
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="size-5" aria-hidden />
          <span className="truncate">{label}</span>
          <span
            aria-hidden
            className={cn("size-1 rounded-full", isActive ? "bg-primary" : "bg-transparent")}
          />
        </>
      )}
    </NavLink>
  );
}

/** Overflow destinations behind the More button (icons mirror NAV_ITEMS). */
const MORE_ITEMS: ReadonlyArray<{
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { to: ROUTES.reports, label: "Reports", icon: ChartColumn },
  { to: ROUTES.notes, label: "Notes", icon: NotebookPen },
  { to: ROUTES.profile, label: "Profile", icon: User },
];

function MobileTabBar() {
  const { pathname } = useLocation();
  const moreActive = MORE_ITEMS.some(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );

  return (
    <nav
      aria-label="Primary — mobile"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch">
        <MobileSideTab to={ROUTES.dashboard} label="Home" icon={LayoutDashboard} end />
        <MobileSideTab to={ROUTES.categories} label="Categories" icon={Tags} />
        <NavLink
          to={ROUTES.transactions}
          aria-label="Transactions"
          className="flex min-w-0 flex-1 flex-col items-center px-1 pt-2 pb-2 outline-none"
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "flex size-14 -translate-y-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg",
                  isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                <ArrowLeftRight className="size-6" aria-hidden />
              </span>
              <span
                aria-hidden
                className={cn(
                  "-mt-2.5 size-1 rounded-full",
                  isActive ? "bg-primary" : "bg-transparent",
                )}
              />
            </>
          )}
        </NavLink>
        <MobileSideTab to={ROUTES.budgets} label="Budgets" icon={Target} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More navigation options"
              className={cn(
                "flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium outline-none",
                moreActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Ellipsis className="size-5" aria-hidden />
              <span className="truncate">More</span>
              <span
                aria-hidden
                className={cn(
                  "size-1 rounded-full",
                  moreActive ? "bg-primary" : "bg-transparent",
                )}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end">
            {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
              <DropdownMenuItem key={to} asChild>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "flex w-full items-center gap-2",
                      isActive ? "text-primary" : undefined,
                    )
                  }
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="flex-1">{label}</span>
                </NavLink>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}

export function AppShell() {
  const { month, label } = useMonthParam();
  const txnCount = useTransactions({ page: 1 });

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
        {/* Sticky sidebar: fixed to the viewport so the user card + logout
            stay visible while page content scrolls (PRD §10 UX). */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-[#0f172a] text-slate-300 md:flex">
          <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
            <img src="/favicon.svg" alt="" className="size-7 rounded-lg" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-white">ExpenseTracker</p>
              <p className="text-[11px] text-slate-400">MVP · BDT</p>
            </div>
          </div>
          <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {NAV_ITEMS.map(({ to, label: navLabel, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === ROUTES.dashboard}
                className={({ isActive }) =>
                  cn(
                    ITEM_BASE,
                    isActive
                      ? "bg-white/5 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white",
                  )
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{navLabel}</span>
                {to === ROUTES.transactions && txnCount.data ? (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] tabular-nums">
                    {txnCount.data.count}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <OverallBudgetCard month={month} label={label} />
          <UserCard />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-14 items-center justify-between gap-2 border-b border-white/10 bg-[#0f172a] px-4 text-white md:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <img src="/favicon.svg" alt="" className="size-6 rounded-md" aria-hidden />
              <span className="truncate text-sm font-semibold">{APP_NAME}</span>
            </div>
            <AccountMenu
              avatarClassName="size-10 text-base"
              triggerClassName="size-11 text-white hover:bg-white/10 hover:text-white"
              fallbackIconClassName="size-7"
            />
          </div>
          <Topbar />
          <main id="main" className="min-w-0 flex-1 bg-[#f4f5f7] p-4 pb-28 md:p-6 dark:bg-background">
            {/*
              Content width: a comfortable 1180px on laptops (the sidebar +
              padding already leave less than that, so the page fills the
              viewport), stretched to 1600px on 2xl desktops so wide screens
              don't end up with big empty gutters on the left and right.
            */}
            <div className="mx-auto max-w-[1180px] 2xl:max-w-[1600px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <MobileTabBar />
      <Toaster />
    </div>
  );
}
