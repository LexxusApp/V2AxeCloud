import { useState, useRef } from 'react';
import { CalendarDays, Link2, Plus, Trash2 } from 'lucide-react';
import type { HouseProfile, RadarMedia, RadarProfileDraft } from './completion';
import { ufOptions } from './completion';
import { radarDays, radarNetworks, radarTimeRange, type RadarSection } from './radarLogic';
import { RadarMediaEditor, type RadarMediaKind } from './RadarMedia';
import { normalizeTradition } from './remote/radar';

type Props = {
  section: RadarSection;
  draft: RadarProfileDraft;
  onChange: (p: RadarProfileDraft) => void;
  busy: boolean;
  onFiles: (kind: RadarMediaKind, files: File[]) => void;
  onView: (m: RadarMedia) => void;
  account: HouseProfile;
};

function LocationEditor({
  draft,
  onChange,
  field,
}: {
  draft: RadarProfileDraft;
  onChange: (p: RadarProfileDraft) => void;
  field: <K extends keyof RadarProfileDraft>(key: K, value: RadarProfileDraft[K]) => void;
}) {
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [cepMessage, setCepMessage] = useState<string>('');
  const lastFetched = useRef<string>('');

  async function handleCepChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;

    onChange({ ...draft, cep: formatted });

    if (digits.length < 8) {
      setCepStatus('idle');
      setCepMessage('');
      return;
    }

    if (digits === lastFetched.current) return;
    lastFetched.current = digits;

    setCepStatus('loading');
    setCepMessage('Localizando endereço pelo CEP...');

    try {
      let data: { logradouro?: string; bairro?: string; cidade?: string; estado?: string } | null = null;

      // 1. Tenta API pública do AxéCloud
      try {
        const res = await fetch(`/api/v1/public/cep/${digits}`, { signal: AbortSignal.timeout(3500) });
        if (res.ok) data = await res.json();
      } catch {}

      // 2. Fallback direto ViaCEP
      if (!data || !data.cidade) {
        try {
          const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            const raw = await res.json();
            if (!raw.erro) {
              data = {
                logradouro: raw.logradouro || '',
                bairro: raw.bairro || '',
                cidade: raw.localidade || '',
                estado: raw.uf ? raw.uf.toUpperCase() : '',
              };
            }
          }
        } catch {}
      }

      if (!data || !data.cidade) {
        setCepStatus('error');
        setCepMessage('CEP não localizado. Preencha manualmente.');
        return;
      }

      const st = String(data.estado || '').toUpperCase().slice(0, 2);
      const matchedUf = ufOptions.includes(st) ? st : draft.uf;

      onChange({
        ...draft,
        cep: formatted,
        address: data.logradouro || draft.address,
        neighborhood: data.bairro || draft.neighborhood,
        city: data.cidade || draft.city,
        uf: matchedUf,
      });

      setCepStatus('success');
      setCepMessage('Endereço preenchido automaticamente ✓');
      setTimeout(() => {
        setCepStatus('idle');
        setCepMessage('');
      }, 4000);
    } catch {
      setCepStatus('error');
      setCepMessage('Falha ao consultar CEP. Preencha manualmente.');
    }
  }

  return (
    <div className="rs-editor-stack">
      <div className="rs-section-heading">
        <div>
          <h2>O caminho até a sua casa.</h2>
          <p>Endereço e contatos próprios do Radar, sem precisar editar a conta.</p>
        </div>
      </div>
      <label className="finish-check rs-address-visibility">
        <input type="checkbox" checked={draft.showAddress} onChange={e => field('showAddress', e.target.checked)} />
        <span>
          <strong>Exibir endereço completo no perfil público</strong>
          <small>
            {draft.showAddress
              ? 'Endereço e link do mapa ficarão disponíveis depois de salvar.'
              : 'Visitantes verão somente cidade e estado. Endereço, mapa e coordenadas ficam reservados.'}
          </small>
        </span>
      </label>
      <div className="rs-address-fields">
        <label className="wf-field rs-wide">
          Logradouro
          <input maxLength={160} value={draft.address} onChange={e => field('address', e.target.value)} placeholder="Rua, avenida, estrada…" />
        </label>
        <label className="wf-field">
          Número
          <input maxLength={15} disabled={draft.noNumber} value={draft.number} onChange={e => field('number', e.target.value)} />
        </label>
        <label className="finish-check rs-no-number">
          <input type="checkbox" checked={draft.noNumber} onChange={e => field('noNumber', e.target.checked)} />
          Sem número
        </label>
        <label className="wf-field">
          Complemento
          <input maxLength={100} value={draft.complement} onChange={e => field('complement', e.target.value)} placeholder="Casa, entrada, referência…" />
        </label>
        <label className="wf-field">
          Bairro
          <input maxLength={80} value={draft.neighborhood} onChange={e => field('neighborhood', e.target.value)} />
        </label>
        <label className="wf-field">
          CEP
          <input
            maxLength={9}
            inputMode="numeric"
            value={draft.cep}
            onChange={e => handleCepChange(e.target.value)}
            placeholder="00000-000"
          />
          {cepMessage ? (
            <small
              style={{
                color: cepStatus === 'loading' ? '#b45309' : cepStatus === 'success' ? '#15803d' : '#b91c1c',
                fontWeight: 600,
                display: 'block',
                marginTop: '4px',
              }}
            >
              {cepMessage}
            </small>
          ) : (
            <small style={{ color: '#78716c', display: 'block', marginTop: '4px' }}>
              Digite o CEP para preencher rua, bairro, cidade e estado.
            </small>
          )}
        </label>
        <label className="wf-field">
          Cidade do perfil público
          <input required maxLength={80} value={draft.city} onChange={e => field('city', e.target.value)} />
        </label>
        <label className="wf-field">
          Estado do perfil público
          <select value={draft.uf} onChange={e => field('uf', e.target.value)}>
            {ufOptions.map(uf => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </label>
        <label className="wf-field rs-wide">
          Link do Google Maps
          <input type="url" maxLength={1000} value={draft.mapsUrl} onChange={e => field('mapsUrl', e.target.value)} placeholder="https://maps.app.goo.gl/…" />
          <small>Use um link HTTPS do Google Maps com a localização da sua casa.</small>
        </label>
        <label className="wf-field">
          Latitude
          <input inputMode="decimal" value={draft.latitude} onChange={e => field('latitude', e.target.value)} placeholder="Ex.: -23,5505" />
        </label>
        <label className="wf-field">
          Longitude
          <input inputMode="decimal" value={draft.longitude} onChange={e => field('longitude', e.target.value)} placeholder="Ex.: -46,6333" />
        </label>
      </div>
      <p className="finish-note">O mapa deste protótipo é esquemático. Coordenadas informadas não reposicionam um mapa geográfico real.</p>
      <section className="rs-editor-subsection">
        <h3>Contatos para visitantes</h3>
        <div className="rs-fields-two">
          <label className="wf-field">
            WhatsApp público
            <input type="tel" maxLength={20} value={draft.phone} onChange={e => field('phone', e.target.value)} />
            <small>DDD + número. Este contato poderá aparecer no perfil público.</small>
          </label>
          <label className="wf-field">
            WhatsApp para atendimentos
            <input type="tel" maxLength={20} value={draft.servicePhone} onChange={e => field('servicePhone', e.target.value)} />
            <small>Um canal específico para os atendimentos, se a casa desejar.</small>
          </label>
        </div>
      </section>
      <section className="rs-editor-subsection">
        <div className="rs-section-heading">
          <div>
            <h3>As redes da sua casa</h3>
            <p>Instagram, Facebook, TikTok, YouTube e site oficial.</p>
          </div>
          <button
            type="button"
            className="wf-button secondary"
            disabled={draft.socials.length >= 5}
            onClick={() => {
              const network = (Object.keys(radarNetworks) as (keyof typeof radarNetworks)[]).find(
                n => !draft.socials.some(s => s.network === n),
              );
              if (network) field('socials', [...draft.socials, { id: crypto.randomUUID(), network, url: '' }]);
            }}
          >
            <Plus size={16} />Adicionar rede social
          </button>
        </div>
        {!draft.socials.length ? (
          <p className="rs-empty-inline">
            <Link2 size={18} />Nenhuma rede adicionada. Os links só aparecem ao salvar.
          </p>
        ) : (
          <div className="rs-social-editor">
            {draft.socials.map((s, i) => (
              <div key={s.id}>
                <label className="wf-field">
                  Rede social {i + 1}
                  <select
                    value={s.network}
                    onChange={e =>
                      field(
                        'socials',
                        draft.socials.map(item =>
                          item.id === s.id ? { ...item, network: e.target.value as typeof s.network } : item,
                        ),
                      )
                    }
                  >
                    {Object.entries(radarNetworks).map(([id, name]) => (
                      <option key={id} value={id} disabled={id !== s.network && draft.socials.some(item => item.network === id)}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wf-field">
                  Link da rede social {i + 1}
                  <input
                    required
                    type="url"
                    maxLength={700}
                    value={s.url}
                    onChange={e =>
                      field(
                        'socials',
                        draft.socials.map(item => (item.id === s.id ? { ...item, url: e.target.value } : item)),
                      )
                    }
                    placeholder="https://…"
                  />
                </label>
                <button
                  type="button"
                  className="rs-square-button danger"
                  aria-label={`Remover ${radarNetworks[s.network]}`}
                  onClick={() => field('socials', draft.socials.filter(item => item.id !== s.id))}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function RadarProfileEditor({ section, draft, onChange, busy, onFiles, onView, account }: Props) {
  function field<K extends keyof RadarProfileDraft>(key: K, value: RadarProfileDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  if (section === 'gallery') return <RadarMediaEditor {...{ draft, onChange, busy, onFiles, onView, account }} section="gallery" />;

  if (section === 'identity')
    return (
      <div className="rs-editor-stack">
        <div className="rs-section-heading">
          <div>
            <h2>O perfil tem a sua identidade.</h2>
            <p>Edite a apresentação pública inteira por aqui. Os dados privados da conta ficam preservados.</p>
          </div>
        </div>
        <RadarMediaEditor {...{ draft, onChange, busy, onFiles, onView, account }} section="identity" />
        <div className="rs-fields-two">
          <label className="wf-field">
            Nome público da casa
            <input maxLength={100} required value={draft.publicName} onChange={e => field('publicName', e.target.value)} />
          </label>
          <label className="wf-field">
            Tradição da casa
            <select value={normalizeTradition(draft.tradition)} onChange={e => field('tradition', e.target.value)}>
              {['Umbanda', 'Candomblé', 'Jurema', 'Mista', 'Outra'].map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="wf-field">
          Biografia da casa
          <textarea required maxLength={2000} value={draft.description} onChange={e => field('description', e.target.value)} />
          <small>{draft.description.length}/2000 caracteres</small>
        </label>
        <label className="wf-field">
          Orientações para visitantes
          <textarea
            required
            maxLength={1500}
            value={draft.instructions}
            onChange={e => field('instructions', e.target.value)}
            placeholder="Conte como chegar, confirmar uma visita e o que a casa orienta."
          />
          <small>{draft.instructions.length}/1500 caracteres</small>
        </label>
      </div>
    );

  if (section === 'location') return <LocationEditor draft={draft} onChange={onChange} field={field} />;

  if (section === 'schedule')
    return (
      <div className="rs-editor-stack">
        <div className="rs-section-heading">
          <div>
            <h2>O ritmo da casa, toda semana.</h2>
            <p>Apresente os dias e horários fixos para quem está planejando uma visita.</p>
          </div>
          <button
            type="button"
            className="wf-button"
            disabled={draft.schedules.length >= 14}
            onClick={() =>
              field('schedules', [...draft.schedules, { id: crypto.randomUUID(), day: 6, start: '20:00', end: '', title: '', enabled: true }])
            }
          >
            <Plus size={17} />Adicionar horário
          </button>
        </div>
        <div className="rs-week" aria-label="Dias com giras disponíveis">
          {radarDays.map((day, i) => (
            <div key={day} className={draft.schedules.some(s => s.enabled && s.day === i) ? 'active' : ''}>
              <span>{day.slice(0, 3)}</span>
              <strong>{draft.schedules.filter(s => s.enabled && s.day === i).length || '–'}</strong>
            </div>
          ))}
        </div>
        {!draft.schedules.length ? (
          <div className="rs-gallery-empty">
            <CalendarDays size={32} />
            <h3>Nenhum horário fixo cadastrado.</h3>
            <p>Adicione os encontros recorrentes que deseja mostrar no perfil.</p>
          </div>
        ) : (
          <div className="rs-schedule-editor">
            {draft.schedules.map((s, i) => (
              <article key={s.id}>
                <div className="rs-section-heading">
                  <strong>Horário {i + 1}</strong>
                  <label className="finish-check">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={e =>
                        field(
                          'schedules',
                          draft.schedules.map(row => (row.id === s.id ? { ...row, enabled: e.target.checked } : row)),
                        )
                      }
                    />
                    Exibir este horário
                  </label>
                  <button
                    type="button"
                    className="rs-square-button danger"
                    aria-label={`Remover horário ${i + 1}`}
                    onClick={() => field('schedules', draft.schedules.filter(row => row.id !== s.id))}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="rs-fields-two">
                  <label className="wf-field rs-wide">
                    Nome da gira {i + 1}
                    <input
                      required
                      maxLength={90}
                      value={s.title}
                      onChange={e =>
                        field(
                          'schedules',
                          draft.schedules.map(row => (row.id === s.id ? { ...row, title: e.target.value } : row)),
                        )
                      }
                      placeholder="Como a casa chama este encontro?"
                    />
                  </label>
                  <label className="wf-field">
                    Dia da gira {i + 1}
                    <select
                      value={s.day}
                      onChange={e =>
                        field(
                          'schedules',
                          draft.schedules.map(row => (row.id === s.id ? { ...row, day: Number(e.target.value) } : row)),
                        )
                      }
                    >
                      {radarDays.map((day, n) => (
                        <option key={day} value={n}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="wf-field">
                    Início da gira {i + 1}
                    <input
                      required
                      type="time"
                      value={s.start}
                      onInput={e =>
                        field(
                          'schedules',
                          draft.schedules.map(row => (row.id === s.id ? { ...row, start: e.currentTarget.value } : row)),
                        )
                      }
                      onChange={e =>
                        field(
                          'schedules',
                          draft.schedules.map(row => (row.id === s.id ? { ...row, start: e.target.value } : row)),
                        )
                      }
                    />
                  </label>
                  <label className="wf-field">
                    Término da gira {i + 1} (opcional)
                    <input
                      type="time"
                      value={s.end}
                      onInput={e =>
                        field(
                          'schedules',
                          draft.schedules.map(row => (row.id === s.id ? { ...row, end: e.currentTarget.value } : row)),
                        )
                      }
                      onChange={e =>
                        field(
                          'schedules',
                          draft.schedules.map(row => (row.id === s.id ? { ...row, end: e.target.value } : row)),
                        )
                      }
                    />
                  </label>
                  <p className="rs-schedule-summary">
                    {radarDays[s.day]} · {radarTimeRange(s)}
                    <br />
                    {s.enabled ? 'Toda semana · horário de Brasília' : 'Pausado no perfil público'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="finish-note">
          Rotina pública independente do calendário interno. Não cria eventos, confirmações ou avisos. Limite de 14 horários; termino anterior ao
          início indica o dia seguinte.
        </p>
      </div>
    );

  return null;
}
