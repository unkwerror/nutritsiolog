'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'

type NavbarProps = {
  transparent?: boolean
}

export function Navbar({ transparent = true }: NavbarProps) {
  const { user, isLoading, logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <nav
      className="relative z-30 flex items-center justify-between px-5 sm:px-8 lg:px-14 py-4 lg:py-5"
      style={!transparent ? { background: 'rgba(53,70,47,0.9)', backdropFilter: 'blur(12px)' } : undefined}
    >
      {/* Logo */}
      <Link
        href="/"
        className="font-display italic text-white/80 hover:text-white transition-colors text-lg tracking-wide"
      >
        Нутрициолог
      </Link>

      {/* Desktop center links */}
      <div className="hidden md:flex items-center gap-1">
        <NavLink href="/#how">Как это работает</NavLink>
        <NavLink href="/#start">О сервисе</NavLink>
      </div>

      {/* Desktop right */}
      <div className="hidden md:flex items-center gap-2">
        {isLoading ? null : user ? (
          <>
            <NavLink href="/dashboard">
              {user.firstName ?? user.email.split('@')[0]}
            </NavLink>
            <button
              onClick={() => void logout()}
              className="px-3 py-2 text-white/55 hover:text-white text-sm transition-colors"
            >
              Выйти
            </button>
          </>
        ) : (
          <>
            <NavLink href="/auth">Войти</NavLink>
            <Link
              href="/auth"
              className="px-4 py-2 text-sm border border-white/25 rounded-xl text-white/80 hover:border-white/50 hover:text-white transition-all"
            >
              Регистрация
            </Link>
          </>
        )}
      </div>

      {/* Mobile burger */}
      <button
        className="md:hidden flex flex-col gap-1.5 p-2"
        aria-label="Меню"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`block h-0.5 w-5 bg-white transition-transform ${open ? 'translate-y-2 rotate-45' : ''}`} />
        <span className={`block h-0.5 w-5 bg-white transition-opacity ${open ? 'opacity-0' : ''}`} />
        <span className={`block h-0.5 w-5 bg-white transition-transform ${open ? '-translate-y-2 -rotate-45' : ''}`} />
      </button>

      {/* Mobile menu */}
      {open && (
        <div className="absolute top-full left-0 right-0 glass-modal py-4 px-5 flex flex-col gap-2 md:hidden">
          <MobileNavLink href="/#how" onClick={() => setOpen(false)}>Как это работает</MobileNavLink>
          {user ? (
            <>
              <MobileNavLink href="/dashboard" onClick={() => setOpen(false)}>Мой профиль</MobileNavLink>
              <button
                onClick={() => { setOpen(false); void logout() }}
                className="text-left py-2.5 text-white/60 hover:text-white text-base transition-colors"
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <MobileNavLink href="/auth" onClick={() => setOpen(false)}>Войти</MobileNavLink>
              <MobileNavLink href="/auth" onClick={() => setOpen(false)}>Регистрация</MobileNavLink>
            </>
          )}
        </div>
      )}
    </nav>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2.5 text-white/70 hover:text-white transition-colors text-sm font-medium whitespace-nowrap"
    >
      {children}
    </Link>
  )
}

function MobileNavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="py-2.5 text-white/80 hover:text-white transition-colors text-base"
    >
      {children}
    </Link>
  )
}
