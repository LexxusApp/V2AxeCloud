import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Archive,
  ArrowUpRight,
  CalendarCheck,
  Camera,
  Check,
  ClipboardCheck,
  Megaphone,
  PackageCheck,
  Users,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CalendarEvent } from '../../views/Calendar';
import { authFetch } from '../../lib/authenticatedFetch';
import { fetchMapaVelas, fetchParticipantes } from '../../lib/giraOperations';

type Props = {
  event: CalendarEvent;
  tenantId?: string;
  confirmedCount: number;
  unconfirmedCount: number;
  onNavigate: (tab: string) => void;
  onOpenEvent: () => void;
};

const steps = [
  { id: 'agenda', title: 'Fundamento e agenda', detail: 'Revise horário, rito e orientações da gira.', tab: 'calendar', icon: CalendarCheck },
  { id: 'corrente', title: 'Corrente confirmada', detail: 'Confira filhos, funções e convidados.', tab: 'children', icon: Users },
  { id: 'estoque', title: 'Materiais separados', detail: 'Reserve velas, bebidas e itens de trabalho.', tab: 'inventory', icon: PackageCheck },
  { id: 'comunicacao', title: 'Corrente avisada', detail: 'Publique orientações e lembretes oficiais.', tab: 'mural', icon: Megaphone },
  { id: 'presenca', title: 'Presença preparada', detail: 'Deixe a chamada e o acolhimento prontos.', tab: 'frequencia', icon: ClipboardCheck },
  { id: 'memoria', title: 'Memória da gira', detail: 'Prepare o álbum para registrar o movimento.', tab: 'gallery', icon: Camera },
] as const;

type StepId = (typeof steps)[number]['id'];
type PreparationState = Record<StepId, boolean>;
type Signal = { done: boolean; detail: string; source: 'automático' | 'manual'; warning?: boolean };
type Signals = Record<StepId, Signal>;

const initialState: PreparationState = {
  agenda: false,
  corrente: false,
  estoque: false,
  comunicacao: false,
  presenca: false,
  memoria: false,
};

const initialSignals: Signals = {
  agenda: { done: true, detail: 'Evento cadastrado na agenda', source: 'automático' },
  corrente: { done: false, detail: 'Aguardando confirmações', source: 'automático' },
  estoque: { done: false, detail: 'Estoque ainda não conferido', source: 'automático' },
  comunicacao: { done: false, detail: 'Nenhum aviso relacionado encontrado', source: 'automático' },
  presenca: { done: false, detail: 'Preparando controle de presença', source: 'automático' },
  memoria: { done: false, detail: 'Nenhum álbum relacionado encontrado', source: 'automático' },
};

function normalize(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function GiraPreparationCenter({
  event,
  tenantId,
  confirmedCount,
  unconfirmedCount,
  onNavigate,
  onOpenEvent,
}: Props) {
  const storageKey = `axecloud:gira-preparation:${tenantId || 'local'}:${event.id}`;
  const [manual, setManual] = useState<PreparationState>(initialState);
  const [signals, setSignals] = useState<Signals>(initialSignals);
  const [loadingSignals, setLoadingSignals] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      setManual(saved ? { ...initialState, ...JSON.parse(saved) } : initialState);
    } catch {
      setManual(initialState);
    }
  }, [storageKey]);

  useEffect(() => {
    let active = true;
    const loadSignals = async () => {
      setLoadingSignals(true);
      const current: Signals = {
        ...initialSignals,
        corrente: {
          done: confirmedCount > 0,
          detail: confirmedCount > 0
            ? `${confirmedCount} confirmado${confirmedCount === 1 ? '' : 's'} · ${unconfirmedCount} sem resposta`
            : `${unconfirmedCount} pessoa${unconfirmedCount === 1 ? '' : 's'} ainda sem resposta`,
          source: 'automático',
          warning: confirmedCount === 0,
        },
      };

      if (!tenantId) {
        if (active) {
          setSignals(current);
          setLoadingSignals(false);
        }
        return;
      }

      const [participantsResult, candlesResult, inventoryResult, noticesResult, galleryResult, logsResult] =
        await Promise.allSettled([
          fetchParticipantes(event.id, tenantId),
          fetchMapaVelas(event.id, tenantId),
          authFetch(`/api/inventory?tenantId=${encodeURIComponent(tenantId)}`).then((response) => response.ok ? response.json() : Promise.reject()),
          authFetch(`/api/notices?tenantId=${encodeURIComponent(tenantId)}`).then((response) => response.ok ? response.json() : Promise.reject()),
          authFetch(`/api/v1/gallery/albums?tenantId=${encodeURIComponent(tenantId)}`).then((response) => response.ok ? response.json() : Promise.reject()),
          authFetch('/api/whatsapp/logs?limit=50', { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject()),
        ]);

      if (participantsResult.status === 'fulfilled') {
        current.presenca = {
          done: Boolean(participantsResult.value.checkinUrl),
          detail: participantsResult.value.checkinUrl
            ? 'QR e lista de presença disponíveis'
            : 'Controle de presença ainda indisponível',
          source: 'automático',
        };
      }

      const candles = candlesResult.status === 'fulfilled' ? candlesResult.value : [];
      const inventory = inventoryResult.status === 'fulfilled' && Array.isArray(inventoryResult.value?.data)
        ? inventoryResult.value.data
        : [];
      // fetchMapaVelas devolve 1 linha por filho (placeholder). Só conta quem tem vela definida.
      const assignedCandles = (Array.isArray(candles) ? candles : []).filter(
        (item: { vela?: string | null }) => Boolean(String(item?.vela || '').trim()),
      );
      const lowStock = inventory.filter(
        (item: { quantidade_atual?: number; quantidade_minima?: number }) =>
          Number(item.quantidade_atual) <= Number(item.quantidade_minima),
      );
      current.estoque = {
        done: assignedCandles.length > 0,
        detail: assignedCandles.length > 0
          ? `${assignedCandles.length} vela${assignedCandles.length === 1 ? '' : 's'} definida${assignedCandles.length === 1 ? '' : 's'} no mapa ritual`
          : inventory.length === 0
            ? 'Nenhum material separado ainda — defina velas no mapa ritual'
            : lowStock.length > 0
              ? `${lowStock.length} item${lowStock.length === 1 ? '' : 's'} com estoque baixo no almoxarifado`
              : `${inventory.length} itens no almoxarifado — defina o mapa ritual desta gira`,
        source: 'automático',
        warning: lowStock.length > 0,
      };

      const eventNeedle = normalize(event.titulo);
      const notices = noticesResult.status === 'fulfilled' && Array.isArray(noticesResult.value?.data)
        ? noticesResult.value.data
        : [];
      const logs = logsResult.status === 'fulfilled' && Array.isArray(logsResult.value?.logs)
        ? logsResult.value.logs
        : [];
      const relatedNotice = notices.find((notice: any) =>
        normalize(`${notice.titulo} ${notice.conteudo}`).includes(eventNeedle),
      );
      const relatedLog = logs.find((log: any) => normalize(log.mensagem).includes(eventNeedle));
      current.comunicacao = {
        done: Boolean(relatedNotice || relatedLog),
        detail: relatedLog
          ? 'Aviso da gira localizado no histórico do WhatsApp'
          : relatedNotice
            ? `Comunicado publicado: ${relatedNotice.titulo}`
            : 'Publique um aviso mencionando o nome da gira',
        source: 'automático',
      };

      const albums = galleryResult.status === 'fulfilled' && Array.isArray(galleryResult.value?.albums)
        ? galleryResult.value.albums
        : [];
      const relatedAlbum = albums.find((album: any) =>
        normalize(`${album.name} ${album.description || ''}`).includes(eventNeedle),
      );
      current.memoria = {
        done: Boolean(relatedAlbum),
        detail: relatedAlbum ? `Álbum preparado: ${relatedAlbum.name}` : 'Crie um álbum com o nome da gira',
        source: 'automático',
      };

      if (active) {
        setSignals(current);
        setLoadingSignals(false);
      }
    };
    void loadSignals();
    return () => { active = false; };
  }, [confirmedCount, event.id, event.titulo, tenantId, unconfirmedCount]);

  const effective = useMemo(() => Object.fromEntries(
    steps.map((step) => [step.id, signals[step.id].done || manual[step.id]]),
  ) as PreparationState, [manual, signals]);
  const complete = useMemo(() => Object.values(effective).filter(Boolean).length, [effective]);
  const progress = Math.round((complete / steps.length) * 100);
  const nextStep = steps.find((step) => !effective[step.id]);

  const toggle = (id: StepId) => {
    if (signals[id].done) return;
    setManual((current) => {
      const updated = { ...current, [id]: !current[id] };
      window.localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  const openStep = (id: StepId, tab: string) => {
    if (id === 'agenda') onOpenEvent();
    else onNavigate(tab);
  };

  return (
    <section className="gira-preparation" aria-labelledby="gira-preparation-title">
      <header className="gira-preparation__header">
        <div className="gira-preparation__seal"><Archive /></div>
        <div className="gira-preparation__heading">
          <p>Preparação da próxima gira</p>
          <h2 id="gira-preparation-title">Tudo o que a casa precisa, em uma só jornada.</h2>
          <span>{event.titulo} · {format(parseISO(event.data), "dd 'de' MMMM", { locale: ptBR })}</span>
        </div>
        <div className="gira-preparation__progress" style={{ '--progress': `${progress * 3.6}deg`, '--progress-pct': `${progress}%` } as CSSProperties}>
          <div><strong>{progress}%</strong><span>{complete}/{steps.length}</span></div>
        </div>
      </header>

      <div className="gira-preparation__journey">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const done = effective[step.id];
          const isAutomatic = signals[step.id].done;
          const current = nextStep?.id === step.id;
          return (
            <article key={step.id} className={`gira-preparation__step${done ? ' is-done' : ''}${current ? ' is-current' : ''}${signals[step.id].warning ? ' has-warning' : ''}`}>
              <button type="button" className="gira-preparation__check" onClick={() => toggle(step.id)} disabled={isAutomatic} aria-label={`${done ? 'Desmarcar' : 'Marcar'} ${step.title}`} aria-pressed={done}>
                {done ? <Check /> : <span>{String(index + 1).padStart(2, '0')}</span>}
              </button>
              <div className="gira-preparation__step-icon"><Icon /></div>
              <div className="gira-preparation__copy">
                <div>
                  <strong>{step.title}</strong>
                  {current ? <em>Próxima ação</em> : null}
                  {done ? <small>{isAutomatic ? 'Automático' : 'Manual'}</small> : null}
                </div>
                <p>{loadingSignals && step.id !== 'agenda' && step.id !== 'corrente' ? 'Conferindo dados do módulo...' : signals[step.id].detail}</p>
              </div>
              <button type="button" className="gira-preparation__open" onClick={() => openStep(step.id, step.tab)}>
                Abrir módulo <ArrowUpRight />
              </button>
            </article>
          );
        })}
      </div>

      <footer className="gira-preparation__footer">
        <span>{progress === 100 ? 'Preparação concluída. A casa está pronta.' : `${steps.length - complete} etapas ainda pedem atenção.`}</span>
        {nextStep ? (
          <button type="button" onClick={() => openStep(nextStep.id, nextStep.tab)}>Continuar por {nextStep.title} <ArrowUpRight /></button>
        ) : (
          <button type="button" onClick={onOpenEvent}>Revisar gira <ArrowUpRight /></button>
        )}
      </footer>
    </section>
  );
}
