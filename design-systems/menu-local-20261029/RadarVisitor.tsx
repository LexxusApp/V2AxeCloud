import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Eye,
  Landmark,
  MapPin,
  MessageCircle,
  X,
} from "lucide-react";
import type { LocalRadar, RadarMedia } from "./completion";
import { localDate } from "./completion";
import {
  nextRadarMeeting,
  radarAddress,
  radarDays,
  radarMapsUrl,
  radarNetworks,
  radarPhone,
  radarSocialUrl,
  radarTimeRange,
} from "./radarLogic";
import { RadarPicture } from "./RadarMedia";
export default function RadarVisitor({
  open,
  onOpenChange,
  state,
  onView,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  state: LocalRadar;
  onView: (m: RadarMedia) => void;
}) {
  const opener = useRef<HTMLElement | null>(null);
  const next = nextRadarMeeting(state.schedules),
    phone = radarPhone(state.phone),
    servicePhone = radarPhone(state.servicePhone) || phone,
    maps = state.showAddress ? radarMapsUrl(state.mapsUrl) : null;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="rs-public-overlay" />
        <Dialog.Content
          className="rs-public-dialog"
          onOpenAutoFocus={() => {
            opener.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
            else
              document.querySelector<HTMLElement>("#main-content h1")?.focus();
          }}
        >
          <header className="rs-public-toolbar">
            <div>
              <Dialog.Title>Prévia do perfil público</Dialog.Title>
              <Dialog.Description>
                Somente os dados salvos · nada foi publicado na internet
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="rs-square-button"
                aria-label="Fechar prévia pública"
              >
                <X size={21} />
              </button>
            </Dialog.Close>
          </header>
          <div className="rs-public-scroll">
            {!state.published ? (
              <section className="rs-profile-hidden">
                <Eye size={36} />
                <h2>O perfil está oculto.</h2>
                <p>
                  As informações continuam salvas. Ative a visibilidade do
                  perfil para conferir o que o visitante verá.
                </p>
              </section>
            ) : (
              <div className="rs-visitor-page">
                <div className="rs-visitor-cover">
                  <RadarPicture
                    media={state.cover}
                    alt={`Capa do perfil de ${state.publicName}`}
                    position={state.coverPosition}
                  />
                  {state.cover?.illustrative && (
                    <span>Imagem ilustrativa · IA</span>
                  )}
                  {state.cover && (
                    <button
                      onClick={() => onView(state.cover!)}
                      aria-label="Ver capa inteira"
                    >
                      <Eye size={18} />
                    </button>
                  )}
                </div>
                <section className="rs-visitor-identity">
                  <button
                    className="rs-visitor-portrait"
                    disabled={!state.portrait}
                    aria-label="Ver foto de perfil inteira"
                    onClick={() => state.portrait && onView(state.portrait)}
                  >
                    {state.portrait ? (
                      <RadarPicture
                        media={state.portrait}
                        alt={`Foto de perfil de ${state.publicName}`}
                      />
                    ) : (
                      <Landmark size={35} />
                    )}
                  </button>
                  <div>
                    <span className="rs-visitor-tradition">
                      {state.tradition}
                    </span>
                    <h2>{state.publicName}</h2>
                    <p>
                      <MapPin size={15} />
                      {state.city} · {state.uf}
                    </p>
                  </div>
                  {phone && (
                    <a
                      href={`https://wa.me/${phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rs-contact-link"
                    >
                      <MessageCircle size={17} />
                      Falar com a casa
                      <ArrowUpRight size={16} />
                    </a>
                  )}
                </section>
                <div className="rs-visitor-columns">
                  <aside className="rs-visitor-sidebar">
                    <section className="rs-visitor-next">
                      <CalendarDays size={23} />
                      <h3>
                        {next ? "Próxima gira prevista" : "Encontros da casa"}
                      </h3>
                      {next ? (
                        <>
                          <strong>{next.row.title}</strong>
                          <p>
                            {new Intl.DateTimeFormat("pt-BR", {
                              day: "2-digit",
                              month: "long",
                              weekday: "long",
                              timeZone: "America/Sao_Paulo",
                            }).format(next.date)}
                          </p>
                          <span>{radarTimeRange(next.row)} · Brasília</span>
                        </>
                      ) : (
                        <p>A casa ainda não informou uma rotina fixa.</p>
                      )}
                      <small>
                        Rotina semanal. Confirme a visita com a casa.
                      </small>
                    </section>
                    {state.schedules.some((s) => s.enabled) && (
                      <section className="rs-visitor-hours">
                        <h3>Dias e horários fixos</h3>
                        {state.schedules
                          .filter((s) => s.enabled)
                          .slice()
                          .sort(
                            (a, b) =>
                              a.day - b.day || a.start.localeCompare(b.start),
                          )
                          .map((s) => (
                            <div key={s.id}>
                              <strong>{radarDays[s.day]}</strong>
                              <span>{s.title}</span>
                              <small>{radarTimeRange(s)} · Brasília</small>
                            </div>
                          ))}
                      </section>
                    )}
                    <section className="rs-visitor-location">
                      <MapPin size={22} />
                      <h3>Onde encontrar</h3>
                      <p>
                        {state.showAddress
                          ? radarAddress(state)
                          : `${state.city} · ${state.uf}`}
                      </p>
                      {!state.showAddress && (
                        <small>
                          Endereço completo reservado. Fale com a casa para
                          combinar a visita.
                        </small>
                      )}
                      {maps && (
                        <a
                          href={maps}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ver no Google Maps
                          <ArrowUpRight size={16} />
                        </a>
                      )}
                    </section>
                    {state.socials.length > 0 && (
                      <section className="rs-visitor-socials">
                        <h3>Acompanhe a casa</h3>
                        {state.socials.map((s) => {
                          const href = radarSocialUrl(s);
                          return href ? (
                            <a
                              key={s.id}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {radarNetworks[s.network]}
                              <ArrowUpRight size={16} />
                            </a>
                          ) : null;
                        })}
                      </section>
                    )}
                  </aside>
                  <main className="rs-visitor-main">
                    <section>
                      <h3>Conheça a casa</h3>
                      <p>{state.description}</p>
                    </section>
                    <section>
                      <h3>Antes de chegar</h3>
                      <p>{state.instructions}</p>
                    </section>
                    <section>
                      <div className="rs-section-heading">
                        <h3>Galeria da casa</h3>
                        <span>
                          {state.gallery.length}{" "}
                          {state.gallery.length === 1 ? "foto" : "fotos"}
                        </span>
                      </div>
                      {!state.gallery.length ? (
                        <p className="rs-visitor-empty">
                          Nenhuma foto pública adicionada.
                        </p>
                      ) : (
                        <div className="rs-visitor-gallery">
                          {state.gallery.map((m, i) => (
                            <button
                              key={m.id}
                              onClick={() => onView(m)}
                              aria-label={`Abrir foto pública ${i + 1}`}
                            >
                              <RadarPicture
                                media={m}
                                alt={m.caption || `Foto da casa ${i + 1}`}
                              />
                              {m.illustrative && <small>Ilustração · IA</small>}
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                    {state.posts.some((p) => p.published) && (
                      <section>
                        <h3>Novidades da casa</h3>
                        {state.posts
                          .filter((p) => p.published)
                          .map((p) => (
                            <article className="rs-visitor-post" key={p.id}>
                              <small>{localDate(p.updated)} · Brasília</small>
                              <h4>{p.title}</h4>
                              <p>{p.text}</p>
                            </article>
                          ))}
                      </section>
                    )}
                    {state.services.some((s) => s.available) && (
                      <section>
                        <h3>Atendimentos</h3>
                        {state.services
                          .filter((s) => s.available)
                          .map((s) => (
                            <article className="rs-visitor-service" key={s.id}>
                              <h4>{s.name}</h4>
                              <p>{s.description}</p>
                              <span>
                                <Clock3 size={15} />
                                {s.minutes} minutos
                              </span>
                              {servicePhone && (
                                <a
                                  href={`https://wa.me/${servicePhone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Consultar a casa
                                  <ArrowUpRight size={15} />
                                </a>
                              )}
                            </article>
                          ))}
                      </section>
                    )}
                  </main>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function RadarImageViewer({
  media,
  onClose,
}: {
  media: RadarMedia | null;
  onClose: () => void;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={!!media} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="rs-image-overlay" />
        <Dialog.Content
          className="rs-image-dialog"
          onOpenAutoFocus={() => {
            opener.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
            else
              document.querySelector<HTMLElement>("#main-content h1")?.focus();
          }}
        >
          <header>
            <Dialog.Title>Imagem inteira</Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rs-square-button"
                aria-label="Fechar imagem do Radar"
              >
                <X size={21} />
              </button>
            </Dialog.Close>
          </header>
          <Dialog.Description>
            {media?.illustrative
              ? "Imagem ilustrativa gerada por IA; não é uma foto real de uma casa."
              : media?.caption || "Imagem escolhida para o perfil do Radar."}
          </Dialog.Description>
          {media && (
            <RadarPicture
              media={media}
              alt={media.caption || "Imagem do perfil público do Radar"}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
