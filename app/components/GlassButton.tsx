import { type ButtonHTMLAttributes, type AnchorHTMLAttributes, type ReactNode } from 'react'
import Link from 'next/link'

type BaseProps = {
  children: ReactNode
  variant?: 'gold' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }
type LinkProps = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

type Props = ButtonProps | LinkProps

const variantStyles = {
  gold: 'border-2 border-[#ffe692] text-white font-semibold ' +
    'shadow-[4px_4px_4px_rgba(0,0,0,0.41),inset_1px_1px_2px_rgba(255,255,255,0.7)] ' +
    '[text-shadow:2px_2px_5px_rgba(0,0,0,0.48)] ' +
    'hover:bg-white/10 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
  ghost: 'border border-white/25 text-white/80 hover:text-white hover:border-white/50 ' +
    'active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed',
}

const sizeStyles = {
  sm: 'px-5 py-2.5 text-sm rounded-xl min-h-[40px]',
  md: 'px-6 py-3.5 text-base rounded-xl min-h-[48px]',
  lg: 'px-8 py-4 text-lg rounded-xl min-h-[56px]',
}

export function GlassButton(props: Props) {
  const { children, variant = 'gold', size = 'md', className = '', href, ...rest } = props

  const classes = [
    'inline-flex items-center justify-center font-sans transition-all duration-150 select-none w-full sm:w-auto',
    variantStyles[variant],
    sizeStyles[size],
    className,
  ].join(' ')

  if (href !== undefined) {
    return (
      <Link href={href} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    )
  }

  return (
    <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  )
}
