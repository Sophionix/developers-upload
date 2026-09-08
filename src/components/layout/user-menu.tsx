"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Settings, User as UserIcon } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

type UserMenuProps = {
  name: string;
  email?: string;
  avatarUrl?: string;
  onLogout?: () => void;
  /** Logged-in dashboard (Figma 0:1099): avatar + name + email inline in the top bar. */
  variant?: "avatar-only" | "figma-inline";
};

/**
 * Avatar trigger that opens a dropdown with profile/settings/logout.
 * Keep this dumb — auth wiring happens in Wave 7 by the shell consumer.
 */
export function UserMenu({
  name,
  email,
  avatarUrl,
  onLogout,
  variant = "avatar-only",
}: UserMenuProps) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const robotoUi = {
    fontFamily: "var(--font-roboto-ui), system-ui, sans-serif",
    fontVariationSettings: "'wdth' 100",
  } as const;

  if (variant === "figma-inline") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex min-w-0 max-w-[min(100%,240px)] items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-left outline-none",
            "transition-colors hover:bg-white/5",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          aria-label={`Account menu for ${name}`}
        >
          <Avatar className="size-7 shrink-0 border border-white/20">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-semibold leading-tight text-foreground"
              style={robotoUi}
            >
              {name}
            </p>
            {email ? (
              <p
                className="truncate text-xs leading-4 text-foreground/55"
                style={robotoUi}
              >
                {email}
              </p>
            ) : null}
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-foreground">{name}</span>
            {email && <span className="truncate text-xs font-normal">{email}</span>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/my-profile" className="w-full">
              <UserIcon className="size-4" /> Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="w-full">
              <Settings className="size-4" /> Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onLogout?.()}>
            <LogOut className="size-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Account menu for ${name}`}
      >
        <Avatar className="size-9">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback>{initials || "?"}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-foreground">{name}</span>
          {email && <span className="truncate text-xs font-normal">{email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/my-profile" className="w-full">
            <UserIcon className="size-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="w-full">
            <Settings className="size-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onLogout?.()}>
          <LogOut className="size-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
