import * as React from 'react'
import Link from 'next/link'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { Topbar } from '@/components/layout/topbar'
import { USER_NAV, GUEST_NAV, type NavItem } from '@/lib/nav'
import { Sparkles } from '@/lib/ui/icons'
import { cn } from '@/lib/ui/cn'

type AppShellProps = {
  children: React.ReactNode
  user?: {
    name: string
    email?: string
    avatarUrl?: string
  }
  isGuest?: boolean
  /** Guest shell only: Signup / Login in the top bar instead of greeting + user menu. */
  guestAuthLinks?: boolean
  /** Brand rail: right-aligned pill highlight for the active nav row (guest + logged-in). */
  guestNavActiveStyle?: 'default' | 'trailing-pill'
  /** Optional centered brand (e.g. large mark only for guest shell). */
  sidebarBrandSlot?: React.ReactNode
  /** Override nav items. Defaults to USER_NAV (or GUEST_NAV when isGuest). */
  items?: NavItem[]
  onLogout?: () => void
}

export function AppShell ({
  children,
  user,
  isGuest,
  guestAuthLinks,
  guestNavActiveStyle = 'trailing-pill',
  sidebarBrandSlot,
  items,
  onLogout
}: AppShellProps) {
  const navItems = items ?? (isGuest ? GUEST_NAV : USER_NAV)
  const displayUser = user ?? { name: 'Guest' }

  const guestFooter = isGuest ? (
    <Link
      href='/subscription'
      className={cn(
        'relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-[#922b18]/35',
        'bg-gradient-to-br from-[#9a3018]/35 via-[#7a2210]/14 to-brand-900/40 px-4 py-3.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(230,150,135,0.2),inset_0_-1px_0_rgba(0,0,0,0.35),0_14px_40px_rgba(0,0,0,0.35)]',
        'transition-[border-color,box-shadow,background-color] duration-(--duration-standard) ease-(--ease-brand)',
        'hover:border-[#c44a38]/45 hover:shadow-[inset_0_1px_0_rgba(240,170,155,0.26),0_0_32px_rgba(180,55,40,0.25)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
      )}
    >
      <span className='grid size-10 shrink-0 place-items-center rounded-xl bg-brand-grad text-primary-foreground shadow-glow-brand ring-1 ring-[#c44a38]/35'>
        <Sparkles className='size-5' aria-hidden />
      </span>
      <span className='min-w-0 flex-1 text-left leading-snug'>
        <span className='block text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-white/60'>
          Unlock the full deck
        </span>
        <span className='block text-base'>Upgrade to Premium</span>
      </span>
    </Link>
  ) : undefined

  return (
    <div className='flex h-dvh overflow-hidden'>
      <div className='hidden md:block'>
        <Sidebar
          items={navItems}
          tone='brand'
          navActiveStyle={guestNavActiveStyle}
          guestGate={Boolean(isGuest)}
          brandSlot={sidebarBrandSlot}
          footerSlot={guestFooter}
          {...(onLogout ? { onLogout } : {})}
        />
      </div>

      <div className='relative flex min-w-0 flex-1 flex-col overflow-hidden bg-black'>
        <div
          className="pointer-events-none absolute inset-0 bg-[url('/opace_bg.png')] bg-cover bg-center opacity-20"
          aria-hidden
        />
        <div className='relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
          <div className='w-full min-w-0 shrink-0'>
            <Topbar
              guestAuthLinks={Boolean(guestAuthLinks)}
              leading={
                <MobileNav
                  items={navItems}
                  tone='brand'
                  footerSlot={guestFooter}
                  navActiveStyle={guestNavActiveStyle}
                  guestGate={Boolean(isGuest)}
                />
              }
              {...(guestAuthLinks
                ? {}
                : {
                    userName: displayUser.name,
                    ...(displayUser.email
                      ? { userEmail: displayUser.email }
                      : {}),
                    ...(displayUser.avatarUrl
                      ? { userAvatarUrl: displayUser.avatarUrl }
                      : {}),
                    ...(onLogout ? { onLogout } : {})
                  })}
            />
          </div>
          <main className='flex-1 overflow-y-auto p-4 md:p-6 lg:p-8'>{children}</main>
        </div>
      </div>
    </div>
  )
}
