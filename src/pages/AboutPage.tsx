import { ArrowRight, Building2, Compass, Download, ShieldCheck, Sparkles } from 'lucide-react'
import { ButtonLink } from '../components/ButtonLink'
import { PageIntro } from '../components/PageIntro'
import { Reveal } from '../components/Reveal'
import { Seo } from '../components/Seo'

export default function AboutPage() {
  return (
    <main>
      <Seo
        title="About"
        description="Learn why Zentel Insight is building Jela AI and the principles guiding this intelligent Android companion."
        path="/about"
      />
      <PageIntro
        eyebrow="About Jela AI"
        title="AI should make the next step clearer."
        description="Jela AI is a product of Zentel Insight, created to help people learn with confidence, research with direction and turn complex work into practical progress."
        actions={<ButtonLink href="/features">Explore the product<ArrowRight size={18} /></ButtonLink>}
      />

      <section className="section">
        <div className="container about-story-grid">
          <Reveal>
            <p className="eyebrow">Our purpose</p>
            <h2 className="display-heading">Useful intelligence, grounded in real work.</h2>
          </Reveal>
          <Reveal className="about-story-copy">
            <p>People rarely need another wall of information. They need help understanding a subject, seeing a problem from the right angle and deciding what to do next.</p>
            <p>Jela is being built around that moment. It is intended to be a capable, conversational companion that adapts to the depth of the task while keeping its limitations visible.</p>
          </Reveal>
        </div>
      </section>

      <section className="section section--ash">
        <div className="container principles-grid">
          <Reveal className="principle-card"><Compass /><span>01</span><h2>Clarity first</h2><p>Explain ideas in a way that helps people understand and continue independently.</p></Reveal>
          <Reveal className="principle-card"><Sparkles /><span>02</span><h2>Capability with restraint</h2><p>Build useful experiences without exaggerating what the product can currently do.</p></Reveal>
          <Reveal className="principle-card"><ShieldCheck /><span>03</span><h2>Trust through transparency</h2><p>Make release status, security guidance, privacy choices and limitations understandable.</p></Reveal>
        </div>
      </section>

      <section className="section" id="zentel-insight">
        <div className="container zentel-section">
          <Reveal className="zentel-logo-card">
            <img src="/brand/zentel-insight-logo.jpg" alt="Zentel Insight" />
          </Reveal>
          <Reveal className="zentel-copy">
            <p className="eyebrow">The organisation behind Jela</p>
            <h2>Powered by Zentel Insight.</h2>
            <p>Jela AI is the product. Zentel Insight is the organisation building and powering it. That relationship guides product development, official distribution, documentation and support.</p>
            <div className="brand-relationship">
              <span><img src="/brand/jela-ai-mark.png" alt="" />Jela AI<strong>Product</strong></span>
              <ArrowRight aria-hidden="true" />
              <span><Building2 />Zentel Insight<strong>Organisation</strong></span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="final-cta">
        <div className="container final-cta__inner">
          <div><p className="eyebrow">Follow the product</p><h2>See what Jela is being built to do.</h2></div>
          <div className="button-row">
            <ButtonLink href="/features">View features</ButtonLink>
            <ButtonLink href="/download" variant="success"><Download size={18} />Android release</ButtonLink>
          </div>
        </div>
      </section>
    </main>
  )
}
