import { ArrowUpRight, Download, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

const navigation = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '/features' },
  { label: 'Docs', href: '/docs' },
  { label: 'Download', href: '/download' },
  { label: 'About', href: '/about' },
]

export function Header() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const onHome = pathname === '/'

  useEffect(() => {
    document.body.classList.toggle('menu-open', open)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('menu-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <header className={`site-header ${onHome ? 'site-header--hero' : ''}`}>
      <div className="container site-header__inner">
        <Link className="brand" to="/" aria-label="Jela AI home" onClick={() => setOpen(false)}>
          <img src="/brand/jela-ai-logo.png" alt="" width="42" height="42" />
          <span>Jela AI</span>
        </Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Link className="button button--success header-download" to="/download">
          <Download size={17} aria-hidden="true" />
          Download for Android
        </Link>

        <button
          className="menu-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      <div className={`mobile-menu ${open ? 'mobile-menu--open' : ''}`} id="mobile-navigation">
        <nav className="mobile-menu__nav" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              onClick={() => setOpen(false)}
            >
              <span>{item.label}</span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </NavLink>
          ))}
          <Link className="button button--success" to="/download" onClick={() => setOpen(false)}>
            <Download size={18} aria-hidden="true" />
            Download for Android
          </Link>
        </nav>
      </div>
    </header>
  )
}
