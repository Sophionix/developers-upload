'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthRightColumn, PillInput } from '@/components/features/auth'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { getErrorMessage } from '@/lib/error-messages'
import { ArrowLeft, Loader2, Mail } from '@/lib/ui/icons'

export default function ForgotPasswordPage () {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (!res.ok) {
        const data: { code?: string; message?: string } = await res
          .json()
          .catch(() => ({}))
        toast.error(
          getErrorMessage(data.code ?? 'UNKNOWN', data.message ?? undefined)
        )
        return
      }
      toast.success('Check your inbox for a reset code.')
      router.push(`/forgot-password/verify?email=${encodeURIComponent(email)}`)
    })
  }

  return (
    <AuthRightColumn
      align='top'
      leading={
        <Button asChild variant='outline' size='icon-sm' aria-label='Go back'>
          <Link href='/login'>
            <ArrowLeft className='size-4' />
          </Link>
        </Button>
      }
    >
      <form className='flex flex-col gap-3 xl:gap-6' onSubmit={handleSubmit}>
        <div className='flex flex-col gap-1.5'>
          <h1 className='font-display text-2xl leading-tight text-foreground xl:text-5xl'>
            Forgot Password
          </h1>
          <p className='text-sm text-muted-foreground'>
            Enter your email address or phone number
          </p>
          <span aria-hidden className='h-0.5 w-16 rounded-pill bg-brand-grad' />
        </div>

        <PillInput
          icon={Mail}
          type='email'
          name='email'
          autoComplete='email'
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder='Enter Email Address'
          aria-label='Email address'
        />

        <Button
          type='submit'
          size='lg'
          disabled={pending}
          className='h-11 w-full rounded-pill bg-btn-brand text-white hover:brightness-110 active:brightness-95 xl:h-14'
        >
          {pending ? <Loader2 className='size-4 animate-spin' /> : null}
          Send Reset Code
        </Button>
      </form>
    </AuthRightColumn>
  )
}
