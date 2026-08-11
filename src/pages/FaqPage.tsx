import { Mail } from 'lucide-react'
import { ButtonLink } from '../components/ButtonLink'
import { FaqList } from '../components/FaqList'
import { PageIntro } from '../components/PageIntro'
import { Seo } from '../components/Seo'
import { faqs } from '../data/content'

export default function FaqPage() {
  return (
    <main>
      <Seo
        title="Frequently Asked Questions"
        description="Answers to common questions about Jela AI, the official Android APK, accounts, capabilities and support."
        path="/faq"
      />
      <PageIntro
        eyebrow="Frequently asked questions"
        title="Straight answers about Jela AI."
        description="Find clear information about the product, the public website and the planned Android experience."
      />
      <section className="section">
        <div className="container narrow-container">
          <FaqList items={faqs} />
          <div className="faq-contact">
            <div><p className="eyebrow">Still need help?</p><h2>Ask Zentel Insight directly.</h2></div>
            <ButtonLink href="mailto:zentelinsight@gmail.com" variant="neutral"><Mail size={18} />Email the team</ButtonLink>
          </div>
        </div>
      </section>
    </main>
  )
}
