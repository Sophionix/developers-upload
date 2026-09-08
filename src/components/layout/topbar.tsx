'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Bell } from '@/lib/ui/icons'
import { UserMenu } from '@/components/layout/user-menu'
import { cn } from '@/lib/ui/cn'

type TopbarProps = {
  /** Guest shell: Signup + Login pills instead of greeting + user menu. */
  guestAuthLinks?: boolean
  /** Left-most slot (e.g. MobileNav hamburger on small screens). */
  leading?: ReactNode
  /** Right-most slot — used by AdminShell for UserMenu dropdown. */
  trailing?: ReactNode
  /** Optional middle search field — pass `false` to hide. Used by AdminShell. */
  search?: ReactNode | false
  /** User display name shown in greeting and avatar area (user shell). */
  userName?: string
  /** User email shown below the avatar name (user shell). */
  userEmail?: string
  /** User avatar URL (user shell). */
  userAvatarUrl?: string
  /** Logout handler for user menu dropdown. */
  onLogout?: () => void
  className?: string
}

const robotoUi = {
  fontFamily: 'var(--font-roboto-ui), system-ui, sans-serif',
  fontVariationSettings: "'wdth' 100"
} as const

export function Topbar ({
  guestAuthLinks,
  leading,
  trailing,
  search,
  userName,
  userEmail,
  userAvatarUrl,
  onLogout,
  className
}: TopbarProps) {
  const isUserMode = userName != null && !guestAuthLinks

  return (
    <header
      className={cn(
        'sticky top-0 z-30 shrink-0',
        guestAuthLinks || isUserMode
          ? 'relative isolate h-14 min-h-14 w-full overflow-hidden border-b border-[#922b18]/30 shadow-[inset_0_-14px_36px_-10px_rgba(0,0,0,0.4)]'
          : "flex h-14 items-center gap-3 border-b border-border bg-[url('/topbar-bg.png')] bg-cover bg-center px-4 md:px-6",
        !guestAuthLinks && !isUserMode && className
      )}
    >
      {guestAuthLinks || isUserMode ? (
        <>
          {/*
           * Guest + logged-in topbar — same rail gradient + texture as desktop sidebar (isolated compositing).
           */}
          <div
            className='pointer-events-none absolute inset-0 z-0 bg-rail-grad'
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-[url('/topbar-bg.png')] bg-cover bg-top opacity-[0.76]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-[2] bg-[url('/opace_bg.png')] bg-cover bg-top opacity-[0.1]"
            aria-hidden
          />
          <div
            className='pointer-events-none absolute inset-0 z-[3] bg-gradient-to-r from-brand-900/58 via-brand-900/10 to-[#922b18]/18'
            aria-hidden
          />
          <div
            className='pointer-events-none absolute inset-0 z-[4] bg-gradient-to-b from-transparent via-transparent to-[#922b18]/26'
            aria-hidden
          />
          <div
            className='pointer-events-none absolute inset-0 z-[5] bg-[linear-gradient(100deg,transparent_0%,rgba(215,125,110,0.04)_45%,transparent_72%)]'
            aria-hidden
          />
          <div
            className='pointer-events-none absolute inset-x-0 top-0 z-[6] h-px bg-gradient-to-r from-transparent via-white/30 to-transparent'
            aria-hidden
          />
          <div
            className='pointer-events-none absolute inset-x-0 bottom-0 z-[7] h-px bg-gradient-to-r from-transparent via-[#922b18]/58 to-transparent'
            aria-hidden
          />
          <div
            className={cn(
              'relative z-10 flex h-14 w-full min-w-0 items-center gap-3 px-4',
              !guestAuthLinks && 'gap-3',
              className
            )}
          >
            <div className='flex min-w-0 shrink-0 items-center'>{leading}</div>

            {guestAuthLinks ? (
              <>
                <div className='min-w-0 flex-1' />
                <div className='flex shrink-0 items-center'>
                  <div
                    className='flex items-center gap-2 rounded-full border border-[#922b18]/40 bg-gradient-to-b from-brand-900/70 to-[#0c0202]/95 p-1.5 shadow-[inset_0_1px_0_rgba(220,130,115,0.14),inset_0_-1px_0_rgba(0,0,0,0.45),0_16px_44px_rgba(0,0,0,0.5)] ring-1 ring-white/10 md:gap-2.5 md:p-2'
                    style={{
                      fontFamily:
                        'var(--font-roboto-medium), system-ui, sans-serif',
                      fontVariationSettings: "'wdth' 100"
                    }}
                  >
                    <Link
                      href='/signup?claim=1'
                      className={cn(
                        'flex h-8 cursor-pointer items-center justify-center rounded-full bg-gradient-to-b from-white via-white to-[#fff5eb] px-4 text-xs font-semibold text-brand-900',
                        'shadow-[inset_0_2px_0_rgba(255,255,255,0.65),0_4px_16px_rgba(170,55,40,0.28)] ring-2 ring-[#922b18]/35',
                        'transition-[filter,box-shadow] duration-(--duration-standard) ease-(--ease-brand) hover:brightness-[1.03] active:brightness-[0.98]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900'
                      )}
                    >
                      Signup
                    </Link>
                    <Link
                      href='/login'
                      className={cn(
                        'flex h-8 cursor-pointer items-center justify-center rounded-full border border-[#922b18]/45 bg-gradient-to-b from-brand-900/85 to-[#080101]/98 px-4 text-xs font-semibold text-white',
                        'shadow-[inset_0_1px_0_rgba(220,140,125,0.12),inset_0_-1px_0_rgba(0,0,0,0.5)] transition-[background-color,border-color,box-shadow] duration-(--duration-standard) ease-(--ease-brand)',
                        'hover:border-[#c44a38]/45 hover:from-brand-900 hover:shadow-[0_0_26px_rgba(200,70,55,0.22)]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900'
                      )}
                    >
                      Login
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className='hidden min-w-0 flex-1 flex-col md:flex'>
                  <span className='text-sm font-semibold leading-tight text-foreground'>
                    Hello, {userName}
                  </span>
                  <span
                    className='text-xs leading-snug text-foreground/60'
                    style={robotoUi}
                  >
                    How are you doing today?
                  </span>
                </div>

                <div className='flex-1 md:hidden' />

                <div className='ml-auto flex min-w-0 shrink-0 items-center gap-2'>
                  <Link
                    href='/notifications'
                    className='relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-gradient-to-b from-brand-900/75 to-[#0a0202]/95 text-foreground shadow-[inset_0_1px_0_rgba(210,120,105,0.1)] transition-[border-color,box-shadow] duration-(--duration-micro) ease-(--ease-brand) hover:border-[#922b18]/40 hover:shadow-[0_0_18px_rgba(170,50,40,0.28)]'
                    aria-label='Notifications'
                  >
                    <Bell className='size-3.5' />
                    <span className='absolute right-1 top-1 size-1.5 rounded-full bg-[#bf1616] ring-1 ring-brand-900/80' />
                  </Link>

                  <div
                    className='h-6 w-px shrink-0 bg-gradient-to-b from-transparent via-white/25 to-transparent'
                    aria-hidden
                  />

                  <UserMenu
                    variant='figma-inline'
                    name={userName as string}
                    {...(userEmail ? { email: userEmail } : {})}
                    {...(userAvatarUrl ? { avatarUrl: userAvatarUrl } : {})}
                    {...(onLogout ? { onLogout } : {})}
                  />
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className='flex min-w-0 items-center gap-3'>{leading}</div>

          {search !== false && (
            <div className='hidden min-w-0 flex-1 justify-center md:flex'>
              {search}
            </div>
          )}
          {search === false && <div className='flex-1' />}

          <div className='ml-auto flex shrink-0 items-center gap-2'>
            <Link
              href='/notifications'
              className='flex size-9 items-center justify-center rounded-full bg-black/50 text-foreground transition-colors hover:bg-black/70'
              aria-label='Notifications'
            >
              <Bell className='size-5' />
            </Link>
            {trailing}
          </div>
        </>
      )}
    </header>
  )
}
