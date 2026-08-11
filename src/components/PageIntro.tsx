import type { ReactNode } from 'react'

type PageIntroProps = {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}

export function PageIntro({ eyebrow, title, description, actions }: PageIntroProps) {
  return (
    <section className="page-intro">
      <div className="container page-intro__inner">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-intro__copy">{description}</p>
        {actions ? <div className="button-row">{actions}</div> : null}
      </div>
    </section>
  )
}
