'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'

type NavbarProps = {
  /** true (default) = starts transparent over hero, switches to solid on scroll */
  transparent?: boolean
  /** 'light' (default) = solid white bg | 'dark' = solid forest-green bg */
  variant?: 'light' | 'dark'
}

const FOREST = '#35462f'
const FOREST_BORDER = 'rgba(255,255,255,0.12)'
const WHITE_BORDER = 'rgba(24,24,24,0.08)'

export function Navbar({ transparent = true, variant = 'light' }: NavbarProps) {
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

  // on transparent (landing hero) → always white text
  // on solid light → dark text
  // on solid dark → white text
  const whiteText = !solid || variant === 'dark'

  const solidBg = variant === 'dark'
    ? { background: FOREST, borderBottom: `1px solid ${FOREST_BORDER}` }
    : { background: '#ffffff', borderBottom: `1px solid ${WHITE_BORDER}` }

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 transition-colors duration-300"
      style={solid ? solidBg : { background: 'transparent' }}
    >
      <div className="flex items-center justify-between px-5 sm:px-8 lg:px-14 py-4 lg:py-5">
        {/* Logo */}
        <Link
          href="/"
          className="font-sans italic text-base sm:text-lg tracking-wide transition-colors"
          style={{ color: whiteText ? '#ffffff' : '#181818' }}
        >
          Нутрициолог
        </Link>

        {/* Desktop center links */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/#how" white={whiteText}>Как это работает</NavLink>
          <NavLink href="/#start" white={whiteText}>О сервисе</NavLink>
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-3">
          {isLoading ? null : user ? (
            <>
              <NavLink href="/dashboard" white={whiteText}>
                {user.firstName ?? user.email.split('@')[0]}
              </NavLink>
              <button
                onClick={() => void logout()}
                className="text-[13px] tracking-[0.08em] uppercase transition-colors"
                style={{ color: whiteText ? 'rgba(255,255,255,0.6)' : '#6d6d6d' }}
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <NavLink href="/auth" white={whiteText}>Войти</NavLink>
              <Link
                href="/auth"
                className="inline-flex items-center justify-center rounded-[75px] px-5 text-[11px] tracking-[0.12em] uppercase transition-all"
                style={{
                  height: 28,
                  border: '1.5px solid currentColor',
                  color: whiteText ? '#ffffff' : '#181818',
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
          {[
            open ? 'translateY(8px) rotate(45deg)' : undefined,
            undefined,
            open ? 'translateY(-8px) rotate(-45deg)' : undefined,
          ].map((transform, i) => (
            <span
              key={i}
              className="block h-0.5 w-5 transition-transform"
              style={{
                background: whiteText ? '#ffffff' : '#181818',
                transform,
                opacity: i === 1 && open ? 0 : 1,
              }}
            />
          ))}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 py-4 px-5 flex flex-col gap-1 md:hidden"
          style={
            variant === 'dark'
              ? { background: FOREST, borderBottom: `1px solid ${FOREST_BORDER}` }
              : { background: '#ffffff', borderBottom: `1px solid ${WHITE_BORDER}` }
          }
        >
          <MobileNavLink href="/#how" onClick={() => setOpen(false)} dark={variant === 'dark'}>
            Как это работает
          </MobileNavLink>
          <MobileNavLink href="/#start" onClick={() => setOpen(false)} dark={variant === 'dark'}>
            О сервисе
          </MobileNavLink>
          {user ? (
            <>
              <MobileNavLink href="/dashboard" onClick={() => setOpen(false)} dark={variant === 'dark'}>
                Мой профиль
              </MobileNavLink>
              <button
                onClick={() => { setOpen(false); void logout() }}
                className="text-left py-2.5 text-base transition-colors"
                style={{ color: variant === 'dark' ? 'rgba(255,255,255,0.55)' : '#6d6d6d' }}
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <MobileNavLink href="/auth" onClick={() => setOpen(false)} dark={variant === 'dark'}>
                Войти
              </MobileNavLink>
              <MobileNavLink href="/auth" onClick={() => setOpen(false)} dark={variant === 'dark'}>
                Регистрация
              </MobileNavLink>
            </>
          )}
        </div>
      )}
    </nav>
  )
}

function NavLink({ href, children, white }: { href: string; children: React.ReactNode; white: boolean }) {
  return (
    <Link
      href={href}
      className="px-3 py-2.5 text-[13px] tracking-[0.08em] uppercase font-normal whitespace-nowrap transition-colors"
      style={{ color: white ? 'rgba(255,255,255,0.78)' : '#181818' }}
    >
      {children}
    </Link>
  )
}

function MobileNavLink({
  href, children, onClick, dark,
}: {
  href: string; children: React.ReactNode; onClick: () => void; dark: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="py-2.5 text-base transition-colors"
      style={{ color: dark ? 'rgba(255,255,255,0.8)' : '#181818' }}
    >
      {children}
    </Link>
  )
}
