import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import {
  FILHO_OPEN_TOUR_EVENT,
  FILHO_TOUR_DONE_KEY,
  FILHO_TOUR_STEPS,
  type FilhoTourStep,
} from '../../constants/filhoGuide';
import { safeLocalStorageGet, safeLocalStorageSet } from '../../lib/browserCapabilities';

type FilhoCoachTourProps = {
  activeTab: string;
  onNavigate: (tab: string) => void;
};

type AnchorBox = { top: number; left: number; width: number; height: number };

const FIND_TIMEOUT_MS = 1600;
const FIND_POLL_MS = 100;
const PAD = 8;

function findTarget(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-filho-tour="${id}"]`);
}

function readBox(el: HTMLElement): AnchorBox {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function pickPlacement(
  box: AnchorBox,
  prefer: FilhoTourStep['prefer'],
  tipW: number,
  tipH: number,
): 'top' | 'bottom' | 'left' | 'right' {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const space = {
    top: box.top,
    bottom: vh - (box.top + box.height),
    left: box.left,
    right: vw - (box.left + box.width),
  };
  const order: Array<'top' | 'bottom' | 'left' | 'right'> = prefer
    ? [prefer, 'bottom', 'top', 'right', 'left']
    : ['bottom', 'top', 'right', 'left'];
  for (const side of order) {
    if (side === 'top' && space.top >= tipH + 28) return 'top';
    if (side === 'bottom' && space.bottom >= tipH + 28) return 'bottom';
    if (side === 'left' && space.left >= tipW + 28) return 'left';
    if (side === 'right' && space.right >= tipW + 28) return 'right';
  }
  return space.bottom >= space.top ? 'bottom' : 'top';
}

export function FilhoCoachTour({ activeTab, onNavigate }: FilhoCoachTourProps) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [box, setBox] = useState<AnchorBox | null>(null);
  const [placement, setPlacement] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');
  const [waiting, setWaiting] = useState(false);

  const step = FILHO_TOUR_STEPS[stepIndex] ?? null;
  const total = FILHO_TOUR_STEPS.length;

  const finish = useCallback(() => {
    safeLocalStorageSet(FILHO_TOUR_DONE_KEY, '1');
    setActive(false);
    setBox(null);
    setWaiting(false);
  }, []);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  useEffect(() => {
    const onOpen = () => start();
    window.addEventListener(FILHO_OPEN_TOUR_EVENT, onOpen);

    if (safeLocalStorageGet(FILHO_TOUR_DONE_KEY) !== '1') {
      const t = window.setTimeout(() => start(), 700);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener(FILHO_OPEN_TOUR_EVENT, onOpen);
      };
    }

    return () => window.removeEventListener(FILHO_OPEN_TOUR_EVENT, onOpen);
  }, [start]);

  const goNext = useCallback(() => {
    setStepIndex((i) => {
      if (i >= FILHO_TOUR_STEPS.length - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [finish]);

  /** Resolve o passo atual: navega, acha o alvo ou pula se não existir. */
  useEffect(() => {
    if (!active || !step) return;
    let cancelled = false;
    let timer: number | undefined;
    let poll: number | undefined;

    setBox(null);
    setWaiting(true);

    const attach = (el: HTMLElement) => {
      if (cancelled) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      window.setTimeout(() => {
        if (cancelled) return;
        const nextBox = readBox(el);
        setBox(nextBox);
        setPlacement(pickPlacement(nextBox, step.prefer, 280, 140));
        setWaiting(false);
      }, 280);
    };

    const tryFind = () => {
      const el = findTarget(step.target);
      if (el) {
        attach(el);
        return true;
      }
      return false;
    };

    if (activeTab !== step.tab) {
      onNavigate(step.tab);
    }

    const started = Date.now();
    const tick = () => {
      if (cancelled) return;
      if (tryFind()) return;
      if (Date.now() - started > FIND_TIMEOUT_MS) {
        // Alvo não existe nesta conta (ex.: sem pendência) — pula.
        setWaiting(false);
        goNext();
        return;
      }
      poll = window.setTimeout(tick, FIND_POLL_MS);
    };

    timer = window.setTimeout(tick, activeTab === step.tab ? 80 : 220);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (poll) window.clearTimeout(poll);
    };
  }, [active, step, activeTab, onNavigate, goNext]);

  useLayoutEffect(() => {
    if (!active || !step || !box) return;
    const sync = () => {
      const el = findTarget(step.target);
      if (!el) return;
      const next = readBox(el);
      setBox(next);
      setPlacement(pickPlacement(next, step.prefer, 280, 140));
    };
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [active, step, box]);

  if (!active || !step) return null;

  const hole = box
    ? {
        top: Math.max(6, box.top - PAD),
        left: Math.max(6, box.left - PAD),
        width: box.width + PAD * 2,
        height: box.height + PAD * 2,
      }
    : null;

  const tipStyle = (() => {
    if (!hole) return { top: '40%', left: '50%', transform: 'translate(-50%, -50%)' } as const;
    const gap = 18;
    const tipW = Math.min(300, window.innerWidth - 24);
    if (placement === 'bottom') {
      return {
        top: hole.top + hole.height + gap,
        left: Math.min(Math.max(12, hole.left + hole.width / 2 - tipW / 2), window.innerWidth - tipW - 12),
        width: tipW,
      };
    }
    if (placement === 'top') {
      return {
        top: Math.max(12, hole.top - gap - 150),
        left: Math.min(Math.max(12, hole.left + hole.width / 2 - tipW / 2), window.innerWidth - tipW - 12),
        width: tipW,
      };
    }
    if (placement === 'left') {
      return {
        top: Math.max(12, hole.top),
        left: Math.max(12, hole.left - tipW - gap),
        width: tipW,
      };
    }
    return {
      top: Math.max(12, hole.top),
      left: Math.min(hole.left + hole.width + gap, window.innerWidth - tipW - 12),
      width: tipW,
    };
  })();

  const line = (() => {
    if (!hole) return null;
    const tipMidX =
      typeof tipStyle.left === 'number' && typeof tipStyle.width === 'number'
        ? tipStyle.left + tipStyle.width / 2
        : window.innerWidth / 2;
    const holeMidX = hole.left + hole.width / 2;
    const holeMidY = hole.top + hole.height / 2;
    if (placement === 'bottom') {
      return { x1: holeMidX, y1: hole.top + hole.height, x2: tipMidX, y2: (tipStyle.top as number) };
    }
    if (placement === 'top') {
      return { x1: holeMidX, y1: hole.top, x2: tipMidX, y2: (tipStyle.top as number) + 150 };
    }
    if (placement === 'left') {
      return {
        x1: hole.left,
        y1: holeMidY,
        x2: (tipStyle.left as number) + (tipStyle.width as number),
        y2: holeMidY,
      };
    }
    return { x1: hole.left + hole.width, y1: holeMidY, x2: tipStyle.left as number, y2: holeMidY };
  })();

  const isLast = stepIndex >= total - 1;

  return (
    <div className="filho-coach" role="dialog" aria-modal="true" aria-label="Tour do portal">
      <div className="filho-coach__dim" aria-hidden>
        {hole ? (
          <div
            className="filho-coach__hole"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
          />
        ) : null}
      </div>

      {line && hole ? (
        <svg className="filho-coach__lines" aria-hidden>
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className="filho-coach__stroke"
          />
          <circle cx={line.x1} cy={line.y1} r="4" className="filho-coach__dot" />
        </svg>
      ) : null}

      <div className={`filho-coach__tip is-${placement}`} style={tipStyle}>
        <header>
          <p>
            Dica {Math.min(stepIndex + 1, total)} de {total}
          </p>
          <button type="button" onClick={finish} aria-label="Pular tour">
            <X aria-hidden />
          </button>
        </header>
        <h2>{step.title}</h2>
        <p>{waiting && !box ? 'Abrindo esta função…' : step.body}</p>
        <footer>
          <button type="button" className="is-ghost" onClick={finish}>
            Pular
          </button>
          <button type="button" className="is-primary" onClick={isLast ? finish : goNext} disabled={waiting && !box}>
            {isLast ? 'Concluir' : 'Próximo'}
            {!isLast ? <ArrowRight aria-hidden /> : null}
          </button>
        </footer>
      </div>
    </div>
  );
}
