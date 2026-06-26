'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'

type NavbarProps = {
  /** Kept for backwards-compat with other pages. When true (default) the bar
   *  starts transparent over a dark hero and switches to solid on scroll. */
  transparent?: boolean
}

export function Navbar({ transparent = true }: NavbarProps) {
  const { user, isLoading, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [solid, setSolid] = useState(!transparent)

  useEffect(() => {
    if (!transparent) {
      setSolid(true)
      return
    }
    const onScroll = () => {
      setSolid(window.scrollY > window.innerHeight * 0.8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [transparent])

  // text/colour tokens
  const dark = !solid // dark section → white text on transparent

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 transition-colors duration-300"
      style={
        solid
          ? { background: '#ffffff', borderBottom: '1px solid rgba(24,24,24,0.08)' }
          : { background: 'transparent' }
      }
    >
      <div className="flex items-center justify-between px-5 sm:px-8 lg:px-14 py-4 lg:py-5">
        {/* Logo */}
        <Link
          href="/"
          className="font-sans italic text-base sm:text-lg tracking-wide transition-colors"
          style={{ color: dark ? '#ffffff' : '#181818' }}
        >
          Нутрициолог
        </Link>

        {/* Desktop center links */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/#how" dark={dark}>Как это работает</NavLink>
          <NavLink href="/#start" dark={dark}>О сервисе</NavLink>
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-3">
          {isLoading ? null : user ? (
            <>
              <NavLink href="/dashboard" dark={dark}>
                {user.firstName ?? user.email.split('@')[0]}
              </NavLink>
              <button
                onClick={() => void logout()}
                className="text-[13px] tracking-[0.08em] uppercase transition-colors"
                style={{ color: dark ? 'rgba(255,255,255,0.6)' : '#6d6d6d' }}
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <NavLink href="/auth" dark={dark}>Войти</NavLink>
              <Link
                href="/auth"
                className="inline-flex items-center justify-center rounded-[75px] px-5 text-[11px] tracking-[0.12em] uppercase transition-all"
                style={{
                  height: 28,
                  border: '1.5px solid currentColor',
                  color: dark ? '#ffffff' : '#181818',
                }}
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
          <span
            className="block h-0.5 w-5 transition-transform"
            style={{
              background: dark ? '#ffffff' : '#181818',
              transform: open ? 'translateY(8px) rotate(45deg)' : undefined,
            }}
          />
          <span
            className="block h-0.5 w-5 transition-opacity"
            style={{ background: dark ? '#ffffff' : '#181818', opacity: open ? 0 : 1 }}
          />
          <span
            className="block h-0.5 w-5 transition-transform"
            style={{
              background: dark ? '#ffffff' : '#181818',
              transform: open ? 'translateY(-8px) rotate(-45deg)' : undefined,
            }}
          />
        </button>
      </div>

      {/* Mobile menu — slide down */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 py-4 px-5 flex flex-col gap-1 md:hidden"
          style={{ background: '#ffffff', borderBottom: '1px solid rgba(24,24,24,0.08)' }}
        >
          <MobileNavLink href="/#how" onClick={() => setOpen(false)}>Как это работает</MobileNavLink>
          <MobileNavLink href="/#start" onClick={() => setOpen(false)}>О сервисе</MobileNavLink>
          {user ? (
            <>
              <MobileNavLink href="/dashboard" onClick={() => setOpen(false)}>Мой профиль</MobileNavLink>
              <button
                onClick={() => { setOpen(false); void logout() }}
                className="text-left py-2.5 text-[#6d6d6d] hover:text-[#181818] text-base transition-colors"
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

function NavLink({ href, children, dark }: { href: string; children: React.ReactNode; dark: boolean }) {
  return (
    <Link
      href={href}
      className="px-3 py-2.5 text-[13px] tracking-[0.08em] uppercase font-normal whitespace-nowrap transition-colors"
      style={{ color: dark ? 'rgba(255,255,255,0.78)' : '#181818' }}
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
      className="py-2.5 text-[#181818] hover:text-[#6d6d6d] transition-colors text-base"
    >
      {children}
    </Link>
  )
}
