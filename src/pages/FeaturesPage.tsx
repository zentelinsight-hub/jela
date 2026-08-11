import { ArrowRight, Clock3, Download, ShieldCheck } from 'lucide-react'
import { ButtonLink } from '../components/ButtonLink'
import { PageIntro } from '../components/PageIntro'
import { Reveal } from '../components/Reveal'
import { Seo } from '../components/Seo'
import { features } from '../data/content'

export default function FeaturesPage() {
  return (
    <main>
      <Seo
        title="Features"
        description="Explore the planned Jela AI capabilities for learning, research, programming, files, study support and more."
        path="/features"
      />
      <PageIntro
        eyebrow="Product capabilities"
        title="Built to support the whole thinking process."
        description="Jela AI is being developed as a flexible Android companion—useful for a quick explanation, a detailed project and the many steps in between."
        actions={
          <>
            <ButtonLink href="/download" variant="success"><Download size={18} />Check Android release</ButtonLink>
            <ButtonLink href="/docs" variant="outline">Read documentation<ArrowRight size={18} /></ButtonLink>
          </>
        }
      />

      <section className="availability-note">
        <div className="container availability-note__inner">
          <Clock3 aria-hidden="true" />
          <p><strong>Release status matters.</strong> The capabilities below describe the intended application experience. Each item is labelled so future functionality is not presented as currently available.</p>
        </div>
      </section>

      <section className="section">
        <div className="container feature-list-grid">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Reveal className="feature-list-card" key={feature.title}>
                <div className="feature-list-card__top">
                  <div className="icon-box"><Icon aria-hidden="true" /></div>
                  <span className={feature.status === 'Coming later' ? 'status-chip status-chip--later' : 'status-chip'}>
                    {feature.status}
                  </span>
                </div>
                <h2>{feature.title}</h2>
                <p>{feature.description}</p>
              </Reveal>
            )
          })}
        </div>
      </section>

      <section className="section section--ash">
        <div className="container responsible-grid">
          <Reveal>
            <p className="eyebrow">Responsible use</p>
            <h2>Powerful assistance still needs human judgement.</h2>
          </Reveal>
          <Reveal>
            <p>AI output can be incomplete or incorrect. Jela is intended to support thinking—not replace reliable sources, professional advice or your own judgement.</p>
            <div className="inline-principles">
              <span><ShieldCheck />Verify important information</span>
              <span><ShieldCheck />Protect sensitive information</span>
              <span><ShieldCheck />Keep the final decision yours</span>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
