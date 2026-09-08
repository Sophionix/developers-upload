'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import {
  AppleSignInButton,
  AuthRightColumn,
  GoogleSignInButton,
  OAuthDivider,
  PillInput
} from '@/components/features/auth'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { getErrorMessage } from '@/lib/error-messages'
import { ArrowLeft, Loader2, Lock, Mail } from '@/lib/ui/icons'

export default function LoginPage () {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [remember, setRemember] = React.useState(true)
  const [pending, startTransition] = React.useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })

      if (result?.error) {
        const errorCode = result.code ?? result.error
        if (errorCode === 'EMAIL_NOT_VERIFIED') {
          toast.error(getErrorMessage(errorCode))
          router.push(
            `/forgot-password/verify?email=${encodeURIComponent(email)}`
          )
          return
        }
        toast.error(getErrorMessage(errorCode))
        return
      }

      // Fetch session to check role and MFA state
      const sessionRes = await fetch('/api/auth/session')
      const session = await sessionRes.json()
      const role = session?.user?.role

      if (role === 'SUPER_ADMIN' || role === 'CONTENT_MANAGER') {
        router.push('/admin')
        return
      }

      router.push('/dashboard')
    })
  }

  const handleOAuth = (provider: 'google' | 'apple') => {
    void signIn(provider, { callbackUrl: '/dashboard' })
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
          Don&apos;t have an account?{' '}
          <Link
            href='/signup'
            className='font-semibold text-foreground underline-offset-4 hover:underline'
          >
            Sign Up
          </Link>
        </p>
      }
    >
      <div className='flex flex-col gap-3 xl:gap-6'>
        <div className='flex flex-col gap-1.5'>
          <h1 className='font-display text-2xl leading-tight text-foreground xl:text-5xl'>
            Welcome Back!
          </h1>
          <p className='text-xs text-muted-foreground xl:text-sm'>Log In to Account</p>
          <span aria-hidden className='h-0.5 w-12 rounded-pill bg-brand-grad xl:w-16' />
        </div>

        <form className='flex flex-col gap-2.5 xl:gap-5' onSubmit={handleSubmit}>
          <div className='flex flex-col gap-2'>
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
              autoComplete='current-password'
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder='Enter Password'
              aria-label='Password'
            />
          </div>

          <div className='flex items-center justify-between'>
            <label className='flex cursor-pointer items-center gap-2 text-xs text-foreground xl:gap-3 xl:text-sm'>
              <Switch checked={remember} onCheckedChange={setRemember} />
              Remember Me
            </label>
            <Link
              href='/forgot-password'
              className='text-xs font-medium text-foreground underline underline-offset-4 hover:text-primary xl:text-sm'
            >
              Forgot Password?
            </Link>
          </div>

          <Button
            type='submit'
            size='lg'
            disabled={pending}
            className='h-11 w-full rounded-pill bg-btn-brand text-white hover:brightness-110 active:brightness-95 xl:h-14'
          >
            {pending ? <Loader2 className='size-4 animate-spin' /> : null}
            Login
          </Button>
        </form>

        <OAuthDivider />

        <div className='flex flex-col gap-2'>
          <AppleSignInButton
            onClick={() => handleOAuth('apple')}
            disabled={pending}
          />
          <GoogleSignInButton
            onClick={() => handleOAuth('google')}
            disabled={pending}
          />
        </div>
      </div>
    </AuthRightColumn>
  )
}
