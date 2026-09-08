'use client'

import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import type { LucideIcon } from '@/lib/ui/icons'

type PillInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'prefix'
> & {
  icon: LucideIcon
  ref?: React.Ref<HTMLInputElement>
}

/**
 * Pill-shaped input with a rounded-md brand-gradient icon tile on the left.
 * Matches the Figma auth inputs (Login/Signup/Forgot/Reset). The wrapper gets
 * the focus ring via `focus-within`, so the underlying input stays borderless.
 */
export function PillInput ({
  icon: Icon,
  className,
  ref,
  ...props
}: PillInputProps) {
  return (
    <div
      className={cn(
        'flex h-11 items-center gap-2 rounded-pill border border-white/10 bg-surface pl-1.5 pr-4 xl:h-14',
        'transition-colors focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40',
        className
      )}
    >
      <span aria-hidden className='grid size-10 shrink-0 place-items-center'>
        <Icon className='size-6 text-primary' />
      </span>
      <input
        {...(ref ? { ref } : {})}
        className='h-full flex-1 border-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
        {...props}
      />
    </div>
  )
}
