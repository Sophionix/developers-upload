'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthRightColumn, PillInput } from '@/components/features/auth'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { getErrorMessage } from '@/lib/error-messages'
import { ArrowLeft, Loader2, Lock } from '@/lib/ui/icons'

export default function ResetPasswordForm () {
  const router = useRouter()
  const search = useSearchParams()
  const token = search.get('token') ?? ''
  const email = search.get('email') ?? ''
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.")
      return
    }
    startTransition(async () => {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password })
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
      toast.success('Password updated. Please log in.')
      router.push('/login')
    })
  }

  return (
    <AuthRightColumn
      align='top'
      leading={
        <Button asChild variant='outline' size='icon-sm' aria-label='Go back'>
          <Link href='/forgot-password/verify'>
            <ArrowLeft className='size-4' />
          </Link>
        </Button>
      }
    >
      <form className='flex flex-col gap-3 xl:gap-6' onSubmit={handleSubmit}>
        <div className='flex flex-col gap-1.5'>
          <h1 className='font-display text-2xl leading-tight text-foreground xl:text-5xl'>
            Reset Password
          </h1>
          <p className='text-sm text-muted-foreground'>Set your new password</p>
          <span aria-hidden className='h-0.5 w-16 rounded-pill bg-brand-grad' />
        </div>

        <div className='flex flex-col gap-3'>
          <PillInput
            icon={Lock}
            type='password'
            name='password'
            autoComplete='new-password'
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder='Enter Password'
            aria-label='New password'
          />
          <PillInput
            icon={Lock}
            type='password'
            name='confirm'
            autoComplete='new-password'
            required
            minLength={8}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder='Confirm Password'
            aria-label='Confirm new password'
          />
        </div>

        <Button
          type='submit'
          size='lg'
          disabled={pending}
          className='h-11 w-full rounded-pill bg-btn-brand text-white hover:brightness-110 active:brightness-95 xl:h-14'
        >
          {pending ? <Loader2 className='size-4 animate-spin' /> : null}
          Continue
        </Button>
      </form>
    </AuthRightColumn>
  )
}
