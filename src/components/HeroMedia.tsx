import { useEffect, useState } from 'react'

const mobileSlides = [
  { src: '/media/mobile/ai-robot.webp', position: '50% 42%' },
  { src: '/media/mobile/ai-learning.webp', position: '62% 38%' },
  { src: '/media/mobile/ai-strategy.webp', position: '43% 50%' },
  { src: '/media/mobile/ai-assistance.webp', position: '66% 35%' },
  { src: '/media/mobile/ai-network.webp', position: '50% 50%' },
]

export function HeroMedia() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % mobileSlides.length)
    }, 5600)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="hero-media" aria-hidden="true">
      <video
        className="hero-video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
      >
        <source src="/media/jela-hero.mp4" type="video/mp4" media="(min-width: 821px)" />
      </video>
      <div className="mobile-slideshow">
        {mobileSlides.map((slide, index) => (
          <img
            key={slide.src}
            className={index === active ? 'mobile-slide mobile-slide--active' : 'mobile-slide'}
            src={slide.src}
            alt=""
            decoding="async"
            fetchPriority={index === 0 ? 'high' : 'auto'}
            style={{ objectPosition: slide.position }}
          />
        ))}
      </div>
      <div className="hero-media__shade" />
      <div className="hero-media__grain" />
    </div>
  )
}
