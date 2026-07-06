import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { LANDING_TESTIMONIALS_HEADING } from '../../constants/landingTestimonials';
import { useLandingTestimonials } from '../../hooks/useLandingTestimonials';
import { LandingSection, LandingSectionHeader } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

export function LandingTestimonials() {
  const { items, loading } = useLandingTestimonials();

  return (
    <LandingSection id="depoimentos" variant="alt" aria-labelledby="depoimentos-head">
      <div className="landing-section-inner">
        <motion.div {...fade}>
          <LandingSectionHeader
            kicker={LANDING_TESTIMONIALS_HEADING.kicker}
            title={LANDING_TESTIMONIALS_HEADING.title}
            titleId="depoimentos-head"
            lead={LANDING_TESTIMONIALS_HEADING.lead}
          />
        </motion.div>

        <div
          className="relative z-10 mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 xl:gap-6"
          aria-busy={loading}
        >
          {items.map((item, index) => (
            <motion.article
              key={item.id}
              initial={fade.initial}
              whileInView={fade.whileInView}
              viewport={fade.viewport}
              transition={{ ...fade.transition, delay: 0.07 * index }}
              className="landing-testimonial-card"
            >
              <Quote className="landing-testimonial-card__icon" strokeWidth={1.5} aria-hidden />
              <blockquote className="landing-testimonial-card__quote">
                <p>&ldquo;{item.quote}&rdquo;</p>
              </blockquote>
              <footer className="landing-testimonial-card__footer">
                <p className="landing-testimonial-card__author">{item.authorName}</p>
                {item.houseName ? (
                  <p className="landing-testimonial-card__house">{item.houseName}</p>
                ) : null}
                {item.authorRole ? (
                  <p className="landing-testimonial-card__role">{item.authorRole}</p>
                ) : null}
                <p className="landing-testimonial-card__location">
                  {item.city} — {item.state}
                </p>
              </footer>
            </motion.article>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
