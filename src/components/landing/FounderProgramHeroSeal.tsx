import { MotionConfig, motion } from 'framer-motion';
import { FOUNDER_PROGRAM } from '../../constants/founderProgram';
import { useFounderProgramStats } from '../../hooks/useFounderProgramStats';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';

type FounderProgramHeroSealProps = {
  className?: string;
};

const pulseTransition = {
  duration: 1.35,
  ease: 'easeInOut' as const,
  repeat: Infinity,
};

const drumBeatTransition = {
  duration: 0.9,
  ease: 'easeInOut' as const,
  repeat: Infinity,
};

function StylizedAtabaque({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 52 68" fill="none" aria-hidden>
      <ellipse cx="26" cy="11" rx="17" ry="6.5" fill="#f3e4c8" stroke="#1b1813" strokeWidth="1.6" />
      <ellipse cx="26" cy="13" rx="18.5" ry="7.5" stroke="#1b1813" strokeWidth="1.2" opacity="0.85" />
      <path
        d="M9 14 C9 14 11 54 26 58 C41 54 43 14 43 14 C43 14 36 16 26 16 C16 16 9 14 9 14 Z"
        fill="url(#atabaque-wood)"
        stroke="#1b1813"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 20 Q26 23 40 20 M11 28 Q26 31 41 28 M12 36 Q26 39 40 36 M13 44 Q26 47 39 44 M14 52 Q26 55 38 52"
        stroke="#d4a574"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <path
        d="M14 54 Q26 57 38 54 Q36 60 26 63 Q16 60 14 54 Z"
        fill="#5c3619"
        stroke="#1b1813"
        strokeWidth="1.2"
      />
      <ellipse cx="26" cy="58.5" rx="11" ry="3.5" fill="#3d2314" stroke="#1b1813" strokeWidth="1" />
      <ellipse cx="26" cy="10" rx="12" ry="3.5" fill="rgba(255,255,255,0.35)" />
      <defs>
        <linearGradient id="atabaque-wood" x1="14" y1="14" x2="38" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a86532" />
          <stop offset="0.45" stopColor="#7c4522" />
          <stop offset="1" stopColor="#5c3619" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function FounderProgramHeroSeal({ className }: FounderProgramHeroSealProps) {
  const { stats, loading } = useFounderProgramStats();

  const slotsLabel =
    !loading && stats.acceptingApplications
      ? `${stats.remainingSlots} vagas`
      : !loading && stats.acceptedHouses > 0
        ? 'Últimas vagas'
        : `${FOUNDER_PROGRAM.maxSlots} vagas`;

  return (
    <div className={cn('founder-sticker-anchor', className)}>
      <MotionConfig reducedMotion="never">
        <motion.a
          href={ROUTES.founderProgram}
          className="founder-sticker founder-sticker--atabaque group"
          aria-label={`Programa Fundador — ${FOUNDER_PROGRAM.freeMonths} meses grátis. ${slotsLabel}`}
        >
          <motion.span
            className="founder-sticker__body"
            animate={{
              rotate: [10, 14, 10],
              scale: [1, 1.05, 1],
            }}
            transition={pulseTransition}
          >
            <motion.span
              className="founder-sticker__halo"
              aria-hidden
              animate={{
                opacity: [0.35, 0.85, 0.35],
                scale: [0.96, 1.06, 0.96],
              }}
              transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity }}
            />
            <motion.span
              className="founder-sticker__burst"
              aria-hidden
              animate={{ filter: ['brightness(1)', 'brightness(1.08)', 'brightness(1)'] }}
              transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
            />
            <motion.span
              className="founder-sticker__ring"
              aria-hidden
              animate={{ opacity: [0.35, 0.8, 0.35] }}
              transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
            />

            <span className="founder-sticker__face">
              <motion.span
                className="founder-sticker__icon founder-sticker__icon--drum"
                aria-hidden
                animate={{
                  scaleY: [1, 1.05, 1],
                  scaleX: [1, 0.97, 1],
                  y: [0, -1, 0],
                }}
                transition={drumBeatTransition}
              >
                <StylizedAtabaque className="founder-sticker__atabaque-art" />
              </motion.span>
              <span className="founder-sticker__label">Programa</span>
              <span className="founder-sticker__title">Fundador</span>
              <span className="founder-sticker__divider" aria-hidden />
              <motion.span
                className="founder-sticker__hot"
                animate={{
                  color: ['#1b1813', '#b45309', '#1b1813'],
                  textShadow: [
                    '0 0 0 rgba(255,255,255,0)',
                    '0 0 8px rgba(255,255,255,0.85)',
                    '0 0 0 rgba(255,255,255,0)',
                  ],
                }}
                transition={{ duration: 0.95, repeat: Infinity, ease: 'linear' }}
              >
                {FOUNDER_PROGRAM.freeMonths} meses grátis
              </motion.span>
              <span className="founder-sticker__slots">{slotsLabel}</span>
              <motion.span
                className="founder-sticker__tap"
                animate={{ opacity: [0.65, 1, 0.65] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                Toque aqui
              </motion.span>
            </span>
          </motion.span>
        </motion.a>
      </MotionConfig>
    </div>
  );
}
