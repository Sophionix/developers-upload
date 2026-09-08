'use client'

import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Sidebar } from '@/components/layout/sidebar'
import { GuestAuthModal } from '@/components/layout/guest-auth-modal'
import { Button } from '@/components/ui/button'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { Menu } from '@/lib/ui/icons'
import type { NavItem } from '@/lib/nav'
import { cn } from '@/lib/ui/cn'

type MobileNavProps = {
  items: NavItem[]
  tone?: 'brand' | 'dark'
  footerSlot?: React.ReactNode
  navActiveStyle?: 'default' | 'trailing-pill'
  /** Guest mode: disabled items open the login/signup modal instead of navigating. */
  guestGate?: boolean
}

/**
 * Hamburger trigger → sliding Sheet with the full Sidebar inside.
 * Rendered only on small viewports; desktop uses the static rail.
 */
export function MobileNav ({
  items,
  tone = 'brand',
  footerSlot,
  navActiveStyle = 'default',
  guestGate = false
}: MobileNavProps) {
  const [open, setOpen] = React.useState(false)
  const [showAuthGate, setShowAuthGate] = React.useState(false)

  // Close the sheet on any navigation.
  const onSelect = React.useCallback(() => setOpen(false), [])

  // Gated (guest) item: close the sheet and open the auth modal. The modal is
  // rendered outside the Sheet so it survives the sheet unmounting on close.
  const onGuestGate = React.useCallback(() => {
    setOpen(false)
    setShowAuthGate(true)
  }, [])

  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          aria-label='Open menu'
          className={cn(
            'md:hidden',
            tone === 'brand' &&
              'border border-[#922b18]/35 bg-gradient-to-b from-brand-900/70 to-[#0a0202]/95 text-white shadow-[inset_0_1px_0_rgba(210,120,105,0.12),0_8px_24px_rgba(0,0,0,0.35)] hover:border-[#c44a38]/45 hover:from-brand-900/85 hover:text-white'
          )}
        >
          <Menu className='size-5' />
        </Button>
      </SheetTrigger>
      <SheetContent
        side='left'
        className={cn(
          'w-[85vw] p-0',
          tone === 'brand' ? 'sm:w-[340px]' : 'sm:w-70'
        )}
      >
        <VisuallyHidden>
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>
              Primary navigation for Sophionix.
            </SheetDescription>
          </SheetHeader>
        </VisuallyHidden>
        <div onClickCapture={onSelect} className='h-full'>
          <Sidebar
            items={items}
            tone={tone}
            footerSlot={footerSlot}
            navActiveStyle={navActiveStyle}
            guestGate={guestGate}
            onGuestGate={onGuestGate}
            className='w-full border-0'
          />
        </div>
      </SheetContent>
    </Sheet>
    {showAuthGate ? (
      <GuestAuthModal onClose={() => setShowAuthGate(false)} />
    ) : null}
    </>
  )
}
