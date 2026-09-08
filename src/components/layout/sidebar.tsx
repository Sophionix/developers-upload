'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/brand'
import type { NavItem } from '@/lib/nav'
import { LogoutModal } from '@/components/layout/logout-modal'
import { GuestAuthModal } from '@/components/layout/guest-auth-modal'
import { cn } from '@/lib/ui/cn'
import { LogOut, Lock } from '@/lib/ui/icons'

type NavActiveStyle = 'default' | 'trailing-pill'

type SidebarProps = {
  items: NavItem[]
  /** Kept for API compatibility with `AppShell` / `MobileNav` (brand rail is unified). */
  navActiveStyle?: NavActiveStyle
  /** Slot rendered below the nav (e.g. logout, user summary). */
  footerSlot?: React.ReactNode
  /** Logout handler — renders a logout button at the sidebar bottom. */
  onLogout?: () => void
  /** Override the brand area. Defaults to the Sophionix <Logo/>. */
  brandSlot?: React.ReactNode
  /** Tighter variant for admin — flat dark surface instead of brand gradient. */
  tone?: 'brand' | 'dark'
  /**
   * Guest mode: render `disabled` items in the normal (non-dimmed) style and,
   * on click, open the login/signup modal instead of navigating.
   */
  guestGate?: boolean
  /**
   * Override the gate action. When provided, a gated item calls this instead of
   * opening the Sidebar's own modal — used by MobileNav so the modal survives
   * the closing sheet (which unmounts the Sidebar).
   */
  onGuestGate?: () => void
  className?: string
}

/**
 * Primary vertical navigation rail. Used by AppShell (brand-gradient tone) and
 * AdminShell (dark tone). Active state derived from the current pathname —
 * the deepest matching prefix wins to keep active highlights stable across
 * route trees.
 *
 * Logged-in brand rail matches Figma sidebar component (node 0:1150):
 * https://www.figma.com/design/O2lZCGIrz2CTsN26QpkHDy/Sophionix-Final-UI?node-id=0-1150
 */
export function Sidebar ({
  items,
  navActiveStyle = 'default',
  footerSlot,
  brandSlot,
  tone = 'brand',
  guestGate = false,
  onGuestGate,
  onLogout,
  className
}: SidebarProps) {
  const pathname = usePathname()
  const activeHref = pickActiveHref(items, pathname)
  const [showLogout, setShowLogout] = React.useState(false)
  const [showAuthGate, setShowAuthGate] = React.useState(false)
  /** Sophionix brand vertical rail (guest + logged-in AppShell). */
  const figmaRailLayers = tone === 'brand'
  void navActiveStyle

  return (
    <aside
      className={cn(
        'relative flex h-dvh shrink-0 flex-col overflow-hidden',
        figmaRailLayers
          ? 'isolate w-[220px] border-r border-[#922b18]/30 text-foreground shadow-[inset_-1px_0_0_rgba(220,130,115,0.1),inset_-16px_0_40px_-12px_rgba(0,0,0,0.35)]'
          : 'w-[220px] bg-popover text-foreground border-r border-border',
        className
      )}
    >
      {tone === 'brand' ? (
        <>
          {/* Brand rail — vertical maroon → amber (design system), then lava + ember texture */}
          <div
            className='pointer-events-none absolute inset-0 z-0 bg-rail-grad'
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-[url('/sidebar-bg.png')] bg-cover bg-center bg-no-repeat opacity-[0.78]"
            aria-hidden
          />
          {/* No blend modes here — soft-light + lava reads as flat grey on screen */}
          <div
            className="pointer-events-none absolute inset-0 z-[2] bg-[url('/opace_bg.png')] bg-cover bg-center opacity-[0.14]"
            aria-hidden
          />
          <div
            className='pointer-events-none absolute inset-0 z-[3] bg-gradient-to-b from-brand-900/50 via-transparent to-[#922b18]/24'
            aria-hidden
          />
          <div
            className='pointer-events-none absolute inset-0 z-[4] bg-[linear-gradient(105deg,transparent_0%,rgba(210,110,95,0.05)_42%,transparent_68%)]'
            aria-hidden
          />
          <div
            className='pointer-events-none absolute inset-x-0 top-0 z-[5] h-px bg-gradient-to-r from-transparent via-white/25 to-transparent'
            aria-hidden
          />
        </>
      ) : null}
      <div className='relative z-10 flex h-full flex-col'>
        <div className={cn(
          figmaRailLayers
            ? 'flex flex-col items-center px-4 pb-3 pt-5 md:pb-2 md:pt-4'
            : 'px-3 py-3'
        )}>
          {brandSlot ?? <Logo size='md' />}
        </div>
        {figmaRailLayers && (
          <div
            className='h-px shrink-0 bg-gradient-to-r from-transparent via-[#c44a38]/30 to-transparent'
            aria-hidden
          />
        )}

        <nav
          className={cn(
            'flex-1 overflow-y-auto',
            figmaRailLayers ? 'px-3 pb-3 pt-2 md:px-2 md:pb-2 md:pt-1' : 'px-2 py-2'
          )}
        >
          <ul className={figmaRailLayers ? 'space-y-1.5 md:space-y-1' : 'space-y-1'}>
            {items.map(item => {
              const active = item.href === activeHref
              const Icon = item.icon
              const isDashboardRow =
                figmaRailLayers && item.href.endsWith('/dashboard')
              // Guest mode turns "disabled" rows into auth gates: they look
              // normal but open the login/signup modal instead of navigating.
              const gated = Boolean(item.disabled) && guestGate
              const inertDisabled = Boolean(item.disabled) && !guestGate

              const rowStyle = isDashboardRow
                ? {
                    fontFamily:
                      'var(--font-roboto-medium), system-ui, sans-serif',
                    fontVariationSettings: "'wdth' 100"
                  }
                : undefined

              const rowClassName = cn(
                'group relative flex w-full items-center gap-2.5 text-left font-medium outline-none',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                figmaRailLayers
                  ? cn(
                      'min-h-12 gap-3 rounded-lg px-4 py-3 text-base leading-snug text-white transition-[background-color,box-shadow,color] duration-(--duration-standard) ease-(--ease-brand) md:min-h-10 md:gap-2.5 md:px-3 md:py-2 md:text-sm',
                      !isDashboardRow && 'font-sans',
                      !active &&
                        'hover:bg-white/[0.06] hover:shadow-[inset_0_0_0_1px_rgba(210,120,105,0.22),0_8px_24px_rgba(0,0,0,0.2)]'
                    )
                  : cn(
                      'rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-primary/20 text-foreground'
                        : 'text-foreground/75 hover:bg-muted'
                    )
              )

              const rowInner = (
                <>
                  {active && figmaRailLayers ? (
                    <span
                      aria-hidden
                      className={cn(
                        'pointer-events-none absolute inset-y-0.5 left-0 z-0 right-0',
                        'rounded-lg',
                        'border border-[#922b18]/40 bg-gradient-to-l from-[rgba(235,150,135,0.2)] via-[#9a3018]/22 to-brand-900/38',
                        'shadow-[inset_4px_0_14px_-3px_rgba(200,80,65,0.35),inset_0_1px_0_rgba(255,200,190,0.28)]',
                      )}
                    />
                  ) : null}
                  <Icon
                    className={cn(
                      'relative z-[1] shrink-0 transition-colors duration-200',
                      figmaRailLayers ? 'size-5 md:size-4' : 'size-4',
                      figmaRailLayers &&
                        active &&
                        'text-white drop-shadow-[0_0_10px_rgba(210,100,85,0.45)]',
                      figmaRailLayers && !active && 'text-white'
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'relative z-[1] truncate',
                      figmaRailLayers &&
                        active &&
                        'font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]',
                      figmaRailLayers &&
                        !active &&
                        'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]'
                    )}
                  >
                    {item.label}
                  </span>
                </>
              )

              return (
                <li key={item.href}>
                  {inertDisabled ? (
                    <span
                      className={cn(
                        'group relative flex items-center font-medium',
                        figmaRailLayers
                          ? 'cursor-not-allowed gap-3 rounded-lg px-4 py-3 text-base leading-snug text-white/50 md:gap-2.5 md:px-3 md:py-2 md:text-sm'
                          : 'cursor-not-allowed gap-2.5 rounded-md px-3 py-2 text-sm opacity-50',
                        !figmaRailLayers && 'text-foreground/40'
                      )}
                      style={rowStyle}
                      title='Sign up to access this feature'
                    >
                      <Icon
                        className={cn(
                          'shrink-0',
                          figmaRailLayers ? 'size-5 text-white md:size-4' : 'size-4'
                        )}
                        aria-hidden
                      />
                      <span className='truncate'>{item.label}</span>
                      {!figmaRailLayers ? (
                        <Lock
                          className='ml-auto size-3.5 shrink-0 opacity-60'
                          aria-hidden
                        />
                      ) : null}
                    </span>
                  ) : gated ? (
                    <button
                      type='button'
                      onClick={() =>
                        onGuestGate ? onGuestGate() : setShowAuthGate(true)
                      }
                      className={rowClassName}
                      style={rowStyle}
                    >
                      {rowInner}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={rowClassName}
                      style={rowStyle}
                    >
                      {rowInner}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {footerSlot && (
          <div
            className={cn(
              'border-t p-4',
              tone === 'brand'
                ? 'border-t border-[#922b18]/25 bg-gradient-to-t from-[#922b18]/12 to-transparent'
                : 'border-border',
              figmaRailLayers && 'px-4 pb-5 pt-3'
            )}
          >
            {footerSlot}
          </div>
        )}

        {tone === 'brand' && onLogout && (
          <div className={cn('pb-4', figmaRailLayers ? 'px-3 pt-1 md:px-2' : 'px-2')}>
            <button
              type='button'
              onClick={() => setShowLogout(true)}
              className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors md:min-h-10 md:gap-2.5 md:px-3 md:py-2 md:text-sm',
                figmaRailLayers
                  ? 'text-white/80 hover:bg-white/[0.06] hover:text-white'
                  : 'text-foreground/75 hover:bg-muted'
              )}
              style={
                figmaRailLayers
                  ? {
                      fontFamily:
                        'var(--font-roboto-medium), system-ui, sans-serif',
                      fontVariationSettings: "'wdth' 100"
                    }
                  : undefined
              }
            >
              <LogOut className='size-5 shrink-0 md:size-4' aria-hidden />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>

      {showLogout ? (
        <LogoutModal
          onConfirm={() => {
            setShowLogout(false)
            onLogout?.()
          }}
          onCancel={() => setShowLogout(false)}
        />
      ) : null}

      {showAuthGate ? (
        <GuestAuthModal onClose={() => setShowAuthGate(false)} />
      ) : null}
    </aside>
  )
}

/**
 * Longest-prefix match so nested routes keep their parent highlighted
 * (e.g. `/admin/users/123` → "Users" active).
 */
function pickActiveHref (
  items: NavItem[],
  pathname: string | null
): string | null {
  if (!pathname) return null
  let match: NavItem | null = null
  for (const item of items) {
    const hit = pathname === item.href || pathname.startsWith(`${item.href}/`)
    if (hit && (!match || item.href.length > match.href.length)) {
      match = item
    }
  }
  return match?.href ?? null
}
