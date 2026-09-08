'use client'

import Image from 'next/image'

/** Centered Sophionix brand mark for the sidebar rail. */
export function SidebarBrandMark () {
  return (
    <div className='flex w-full justify-center py-1'>
      <Image
        src='/logo.svg'
        alt=''
        width={200}
        height={200}
        className='size-[88px] object-contain drop-shadow-[0_0_22px_rgba(200,122,2,0.55)]'
        priority
        aria-hidden
      />
    </div>
  )
}
