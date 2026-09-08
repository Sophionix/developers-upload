'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthRightColumn, PillInput } from '@/components/features/auth'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { getErrorMessage } from '@/lib/error-messages'
import { ArrowLeft, Loader2, Lock, Mail, User } from '@/lib/ui/icons'

export default function SignUpForm () {
  const router = useRouter()
  const search = useSearchParams()
  const claim = search.get('claim') === '1'

  const [fullName, setFullName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [agreed, setAgreed] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords don’t match.')
      return
    }
    if (!agreed) {
      toast.error('Please agree to the Terms & Privacy Policy to continue.')
      return
    }
    startTransition(async () => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, consentTerms: true })
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          code?: string
          message?: string
        } | null
        const msg = getErrorMessage(
          body?.code ?? 'UNKNOWN',
          body?.message ?? undefined
        )
        toast.error(msg)
        return
      }

      if (claim) {
        toast.success('Account created. Guest reflections claimed.')
      } else {
        toast.success('Check your email for a verification code.')
      }
      // Stash the password so the verify step can sign the user in immediately
      // after email verification. Cleared as soon as it's consumed.
      try {
        sessionStorage.setItem('signup:pw', password)
      } catch {
        // sessionStorage unavailable (private mode, etc.) — verify step will
        // fall back to redirecting the user to /login.
      }
      router.push(
        `/forgot-password/verify?intent=signup&email=${encodeURIComponent(
          email
        )}${claim ? '&claim=1' : ''}`
      )
    })
  }

  return (
    <AuthRightColumn
      leading={
        <Button asChild variant='outline' size='icon-sm' aria-label='Go back'>
          <Link href='/welcome'>
            <ArrowLeft className='size-4' />
          </Link>
        </Button>
      }
      footer={
        <p className='text-center text-sm text-muted-foreground'>
          Already have an account?{' '}
          <Link
            href='/login'
            className='font-semibold text-foreground underline-offset-4 hover:underline'
          >
            Sign In
          </Link>
        </p>
      }
    >
      <form className='flex flex-col gap-3 xl:gap-6' onSubmit={handleSubmit}>
        <div className='flex flex-col gap-1.5'>
          <h1 className='font-display text-2xl leading-tight text-foreground xl:text-5xl'>
            Create Your Account
          </h1>
          <p className='text-xs text-muted-foreground xl:text-sm'>Sign Up to Continue!</p>
          <span aria-hidden className='h-0.5 w-12 rounded-pill bg-brand-grad xl:w-16' />
        </div>

        <div className='flex flex-col gap-2'>
          <PillInput
            icon={User}
            type='text'
            name='fullName'
            autoComplete='name'
            required
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder='Enter Full Name'
            aria-label='Full name'
          />
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
            aria-label='Password'
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
            aria-label='Confirm password'
          />
        </div>

        <label className='flex cursor-pointer items-center gap-3 text-sm'>
          <Switch checked={agreed} onCheckedChange={setAgreed} />
          <span className='flex flex-wrap items-baseline gap-1 text-muted-foreground'>
            <span>I Agree To The</span>
            <Link
              href='/terms'
              className='font-semibold text-foreground underline underline-offset-4 hover:text-primary'
            >
              Terms &amp; Conditions
            </Link>
            <span aria-hidden>|</span>
            <Link
              href='/privacy'
              className='font-semibold text-foreground underline underline-offset-4 hover:text-primary'
            >
              Privacy Policy
            </Link>
          </span>
        </label>

        <Button
          type='submit'
          size='lg'
          disabled={pending}
          className='h-11 w-full rounded-pill bg-btn-brand text-white hover:brightness-110 active:brightness-95 xl:h-14'
        >
          {pending ? <Loader2 className='size-4 animate-spin' /> : null}
          Sign Up
        </Button>
      </form>
    </AuthRightColumn>
  )
}
