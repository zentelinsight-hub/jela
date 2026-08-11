import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type ButtonVariant = 'primary' | 'success' | 'neutral' | 'outline'

type ButtonLinkProps = {
  children: ReactNode
  className?: string
  external?: boolean
  href: string
  variant?: ButtonVariant
  download?: boolean
}

export function ButtonLink({
  children,
  className = '',
  external = false,
  href,
  variant = 'primary',
  download = false,
}: ButtonLinkProps) {
  const classes = `button button--${variant} ${className}`.trim()

  if (external || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return (
      <a
        className={classes}
        href={href}
        download={download || undefined}
        rel={external && href.startsWith('http') ? 'noreferrer' : undefined}
      >
        {children}
      </a>
    )
  }

  return (
    <Link className={classes} to={href}>
      {children}
    </Link>
  )
}
