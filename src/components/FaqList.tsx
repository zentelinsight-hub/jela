import { ChevronDown } from 'lucide-react'

type FaqItem = { question: string; answer: string }

export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="faq-list">
      {items.map((item) => (
        <details key={item.question} className="faq-item">
          <summary>
            <span>{item.question}</span>
            <ChevronDown size={20} aria-hidden="true" />
          </summary>
          <div className="faq-item__answer">
            <p>{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  )
}
