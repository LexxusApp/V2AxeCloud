import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../../src/lib/supabase";
import { previewSession } from "./remote/session";
import {CoAdminPermissionsDialog,summarizeCoAdminPermissions,type CoAdminPermissions,type CoAdminEntry} from './CoAdminPermissions';
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import {
  Trash2,
  ArrowRight,
  Check,
  History,
  ImagePlus,
  KeyRound,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { WorkflowDialog, WorkflowEmpty } from "./WorkflowUI";
import { HouseState, HouseStateTools, type HouseMode } from "./HouseStates";
import {
  profileError,
  ufOptions,
  type AccountSetup,
  type HouseProfile,
} from "./completion";
import WhatsAppHistory from "./WhatsAppHistory";
import type { WhatsAppDispatch } from "./whatsappDispatches";
import "./completion.css";
export default function SettingsPage({
  state,
  onChange,
  onNavigate,
  dispatches,
  requestedSection,
}: {
  requestedSection?: { id: number; section: string };
  dispatches: readonly WhatsAppDispatch[];
  state: AccountSetup;
  onChange: (s: AccountSetup) => void;
  onNavigate: (id: string) => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [whatsView, setWhatsView] = useState<"automations" | "history">(
    "automations",
  );
  const [section, setSection] = useState("house"),
    [mode, setMode] = useState<HouseMode>("ready"),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState<
      "connect" | "disconnect" | "reset" | "access" | null
    >(null),
    [photoUrl, setPhotoUrl] = useState(""),
    [reading, setReading] = useState(false);
  const [coAdmins,setCoAdmins] = useState<CoAdminEntry[]>([]);
  const [editingPermissions,setEditingPermissions] = useState<CoAdminEntry|null>(null);
  const [coAdminLoading, setCoAdminLoading] = useState(false);
  const [coAdminBusy, setCoAdminBusy] = useState(false);
  const [coAdminFeedback, setCoAdminFeedback] = useState("");
  const session = (() => { try { return previewSession(); } catch { return null; } })();
  const isDelegatedCoAdmin = session?.profile?.is_co_admin === true || session?.profile?.cargo === "Co-Administrador";
  const canManageCoAdmins = Boolean(session&&session.userId===session.tenantId) && !isDelegatedCoAdmin;

  const parseCoAdminList = (res: any) => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  };

  const loadCoAdmins = async () => {
    if (!canManageCoAdmins) return;
    setCoAdminLoading(true);
    try {
      const { data, error } = await supabase.rpc("piloto_listar_coadministradores", { p_tenant: session!.tenantId });
      if(error)throw error;
      if (!error && data) {
        const list = parseCoAdminList(data);
        setCoAdmins(list.filter((r: any) => r.ativo));
      }
    } catch (err) {
      setCoAdminFeedback('Não foi possível carregar os responsáveis. Tente novamente antes de editar.');
      console.warn("[SettingsPage] Falha ao carregar coadministradores:", err);
    } finally {
      setCoAdminLoading(false);
    }
  };

  useEffect(() => {
    if (canManageCoAdmins) void loadCoAdmins();
  }, [canManageCoAdmins]);

  const savePermissions=async(permissions:CoAdminPermissions,active:boolean)=>{
    if(!canManageCoAdmins||!editingPermissions)throw new Error('Acesso não autorizado.');
    setCoAdminBusy(true);
    try{
      const {data,error}=await supabase.rpc('piloto_salvar_permissoes_coadministrador',{
        p_tenant:session!.tenantId,
        p_filho_id:editingPermissions.filho_id,
        p_permissoes:permissions,
        p_ativo:active,
      });
      if(error||data?.ok!==true)throw error||new Error('O servidor não confirmou a alteração.');
      await loadCoAdmins();
      setCoAdminFeedback(active?'Permissões atualizadas.':'Acesso revogado.');
      setEditingPermissions(null);
    }finally{setCoAdminBusy(false);}
  };

  const fileRef = useRef<HTMLInputElement>(null),
    sequence = useRef(0),
    latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    if (requestedSection) {
      setSection(requestedSection.section);
      setError("");
    }
  }, [requestedSection]);
  useEffect(() => {
    if (!state.draft.photo) {
      setPhotoUrl(state.draft.photoUrl || "");
      return;
    }
    const url = URL.createObjectURL(state.draft.photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [state.draft.photo, state.draft.photoUrl]);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  const dirty = Object.keys(state.profile).some(
    (key) =>
      state.profile[key as keyof HouseProfile] !==
      state.draft[key as keyof HouseProfile],
  );
  const whatsDirty =
    JSON.stringify(state.whatsapp) !== JSON.stringify(state.whatsDraft);
  const setField = async <K extends keyof HouseProfile>(
    key: K,
    value: HouseProfile[K],
  ) => await onChange({ ...state, draft: { ...state.draft, [key]: value } });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const problem = profileError(state.draft);
    if (problem) {
      setError(problem);
      return;
    }
    const profile = {
      ...state.draft,
      house: state.draft.house.trim(),
      responsible: state.draft.responsible.trim(),
      city: state.draft.city.trim(),
      email: state.draft.email.trim(),
      phone: state.draft.phone.replace(/\D/g, ""),
    };
    await onChange({ ...state, profile, draft: { ...profile } });
    setMode("ready");
    setError("");
    setFeedback("Dados confirmados pelo servidor.");
  };
  const readPhoto = async (file?: File) => {
    if (!file) return;
    const token = ++sequence.current;
    setError("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Escolha uma imagem PNG, JPG ou WebP de até 5 MB.");
      return;
    }
    setReading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const valid = bitmap.width >= 64 && bitmap.height >= 64;
      bitmap.close();
      if (token !== sequence.current) return;
      if (!valid)
        throw new Error("A imagem precisa ter pelo menos 64 × 64 pixels.");
      await onChange({
        ...latest.current,
        draft: { ...latest.current.draft, photo: file },
      });
    } catch (e) {
      if (token === sequence.current)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível ler a imagem. Escolha outra.",
        );
    } finally {
      if (token === sequence.current) setReading(false);
    }
  };
  const applyConfirm = async () => {
    if (confirm === "reset") {
      sequence.current++;
      setReading(false);
      await onChange({
        ...state,
        draft: { ...state.profile },
        whatsDraft: { ...state.whatsapp },
      });
      setFeedback(
        "Edições ainda não enviadas foram descartadas. Os dados salvos foram preservados.",
      );
    }
    setConfirm(null);
  };

  if (isDelegatedCoAdmin) {
    return (
      <div className="finish-page settings-local">
        <section style={{ overflow: "hidden", border: "1px solid #d8d0c4", borderRadius: 18, background: "#fffdf8", maxWidth: 850, margin: "0 auto", boxShadow: "0 16px 36px -30px rgba(53,42,25,.7)" }}>
          <div style={{ background: "linear-gradient(135deg,#173323,#214b35)", padding: "24px 26px", display: "flex", alignItems: "flex-start", gap: 15 }}>
            <span style={{ display: "grid", placeItems: "center", width: 46, height: 46, flexShrink: 0, borderRadius: 12, background: "rgba(244,196,48,.12)", color: "#f4c430" }}>
              <ShieldCheck size={24} />
            </span>
            <div>
              <p style={{ margin: 0, color: "#f4c430", fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", fontWeight: 800 }}>Acesso delegado</p>
              <h2 style={{ margin: "5px 0 0", color: "#fff", fontSize: 21, fontWeight: 800 }}>Responsável pelo sistema</h2>
              <p style={{ margin: "7px 0 0", color: "#d5e2d8", fontSize: 13, lineHeight: 1.6 }}>
                Seu acesso permite administrar as atividades da casa autorizadas pela zeladoria titular.
              </p>
            </div>
          </div>
          <div style={{ padding: 26, display: "grid", gap: 14 }}>
            <div style={{ background: "#f1f6f2", border: "1px solid #d8e0d5", borderRadius: 12, padding: 15 }}>
              <strong style={{ display: "block", color: "#17633b", marginBottom: 5 }}>Operação da casa</strong>
              <p style={{ margin: 0, color: "#706658", fontSize: 13, lineHeight: 1.6 }}>Use os módulos liberados de membros, giras, comunicados e rotinas operacionais. Suas ações continuam vinculadas à sua própria conta.</p>
            </div>
            <div style={{ background: "#fff9ed", border: "1px solid #e0d5be", borderRadius: 12, padding: 15 }}>
              <strong style={{ display: "block", color: "#8a6800", marginBottom: 5 }}>Exclusivo do titular</strong>
              <p style={{ margin: 0, color: "#706658", fontSize: 13, lineHeight: 1.6 }}>Dados de titularidade, configurações da conta da casa, assinatura, cobrança do AxéCloud, exclusão do terreiro e delegação de outros responsáveis permanecem protegidos.</p>
            </div>
            <button type="button" className="finish-link" onClick={() => onNavigate("children")} style={{ alignSelf: "start", display: "inline-flex", alignItems: "center", gap: 8, color: "#17633b", fontWeight: 800 }}>
              Abrir corrente <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="finish-page settings-local">
      {feedback && (
        <div role="status" className="wf-feedback">
          <Check size={17} />
          <span>{feedback}</span>
        </div>
      )}
      <div className="settings-layout">
        <nav className="settings-index" aria-label="Seções das configurações">
          {[
            [UserRound, "house", "Conta e casa", "Identidade e contato"],
            [MessageCircle, "whats", "WhatsApp", "Canal e automações"],
            [
              KeyRound,
              "access",
              "Acesso e privacidade",
              "Entenda os controles",
            ],
          ].map(([Icon, id, title, copy]) => {
            const C = Icon as typeof UserRound;
            return (
              <button
                key={String(id)}
                aria-current={section === id ? "page" : undefined}
                onClick={() => {
                  setSection(String(id));
                  setError("");
                }}
              >
                <C size={20} />
                <span>
                  <strong>{String(title)}</strong>
                  <small>{String(copy)}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            );
          })}
          <p>
            Suas edições ainda não salvas permanecem aqui ao navegar pelo
            sistema.
          </p>
          <div className="settings-linked">
            <span>Outras configurações</span>
            <button onClick={() => onNavigate("financial-configs")}>
              Mensalidade e Pix
              <ArrowRight size={15} />
            </button>
            <button onClick={() => onNavigate("radar")}>
              Informações públicas
              <ArrowRight size={15} />
            </button>
            <button onClick={() => onNavigate("subscription")}>
              Assinatura
              <ArrowRight size={15} />
            </button>
          </div>
        </nav>
        <section className="settings-editor">
          {mode === "loading" || mode === "error" ? (
            <HouseState mode={mode} onReset={() => setMode("ready")} />
          ) : mode === "empty" ? (
            <WorkflowEmpty
              title="Nenhuma configuração disponível."
              text="Atualize a página para consultar novamente os dados da sua casa."
            />
          ) : section === "house" ? (
            <>
              <header>
                <h2>A identidade da sua casa</h2>
                <p>
                  Informações reais da zeladoria e da casa. A troca do e-mail de
                  acesso exige confirmação de segurança.
                </p>
              </header>
              <form onSubmit={save}>
                <div className="settings-photo">
                  <div>
                    {photoUrl ? (
                      <img src={photoUrl} alt="Foto selecionada da casa" />
                    ) : (
                      <UserRound size={36} />
                    )}
                  </div>
                  <div>
                    <strong>Foto da casa</strong>
                    <small>PNG, JPG ou WebP · até 5 MB</small>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      aria-label="Arquivo da foto da casa"
                      onChange={async (e) => {
                        void (await readPhoto(e.target.files?.[0]));
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      className="finish-link"
                      disabled={reading}
                      onClick={() => fileRef.current?.click()}
                    >
                      <ImagePlus size={16} />
                      {reading ? "Lendo imagem…" : "Escolher foto"}
                    </button>
                    {state.draft.photo && (
                      <button
                        type="button"
                        className="finish-link danger"
                        onClick={async () => {
                          sequence.current++;
                          setReading(false);
                          await setField("photo", null);
                        }}
                      >
                        Remover foto
                      </button>
                    )}
                  </div>
                </div>
                <div className="finish-form-grid">
                  <label className="wf-field">
                    Nome da casa
                    <input
                      required
                      maxLength={80}
                      value={state.draft.house}
                      onChange={async (e) =>
                        await setField("house", e.target.value)
                      }
                    />
                  </label>
                  <label className="wf-field">
                    Responsável
                    <input
                      required
                      maxLength={80}
                      value={state.draft.responsible}
                      onChange={async (e) =>
                        await setField("responsible", e.target.value)
                      }
                    />
                  </label>
                  <label className="wf-field">
                    Como se identifica
                    <input
                      required
                      maxLength={60}
                      value={state.draft.role}
                      onChange={async (e) =>
                        await setField("role", e.target.value)
                      }
                    />
                  </label>
                  <label className="wf-field">
                    Tradição
                    <select
                      value={state.draft.tradition}
                      onChange={async (e) =>
                        await setField("tradition", e.target.value)
                      }
                    >
                      {["Umbanda", "Candomblé", "Jurema", "Mista", "Outra"].map(
                        (t) => (
                          <option key={t}>{t}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="wf-field">
                    Cidade
                    <input
                      required
                      maxLength={80}
                      value={state.draft.city}
                      onChange={async (e) =>
                        await setField("city", e.target.value)
                      }
                    />
                  </label>
                  <label className="wf-field">
                    Estado
                    <select
                      value={state.draft.uf}
                      onChange={async (e) =>
                        await setField("uf", e.target.value)
                      }
                    >
                      {ufOptions.map((uf) => (
                        <option key={uf}>{uf}</option>
                      ))}
                    </select>
                  </label>
                  <label className="wf-field">
                    E-mail de acesso
                    <input
                      required
                      type="email"
                      readOnly
                      maxLength={120}
                      value={state.draft.email}
                      onChange={async (e) =>
                        await setField("email", e.target.value)
                      }
                    />
                  </label>
                  <label className="wf-field">
                    Telefone com DDD
                    <input
                      required
                      type="tel"
                      maxLength={20}
                      value={state.draft.phone}
                      onChange={async (e) =>
                        await setField("phone", e.target.value)
                      }
                    />
                  </label>
                </div>
                {error && (
                  <p className="wf-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="settings-save">
                  <span>
                    {dirty
                      ? "Há alterações para salvar"
                      : "Dados salvos no sistema"}
                  </span>
                  <div className="finish-actions">
                    <button
                      className="wf-button secondary"
                      type="button"
                      disabled={!dirty || reading}
                      onClick={async () => {
                        sequence.current++;
                        await onChange({
                          ...state,
                          draft: { ...state.profile },
                        });
                        setError("");
                      }}
                    >
                      Descartar edição
                    </button>
                    <button className="wf-button" disabled={!dirty || reading}>
                      Salvar dados da casa
                    </button>
                  </div>
                </div>
              </form>
            </>
          ) : section === "whats" ? (
            <>
              <header>
                <h2>Um canal para a corrente</h2>
                <p>
                  Consulte o canal oficial, as preferências e os disparos
                  registrados.
                </p>
              </header>
              <div className="whats-connection">
                <img src="/whatsapp.svg" alt="" />
                <div>
                  <strong>WhatsApp da casa</strong>
                  <span className="finish-status positive">
                    {state.whatsapp.connected ? "Conectado" : "Desconectado"}
                  </span>
                  <small>Canal oficial da plataforma</small>
                </div>
                <button
                  className="wf-button secondary"
                  onClick={() =>
                    setConfirm(
                      state.whatsapp.connected ? "disconnect" : "connect",
                    )
                  }
                >
                  Sobre a conexão
                </button>
              </div>
              <nav className="wa-view-tabs" aria-label="Área do WhatsApp">
                <button
                  aria-pressed={whatsView === "automations"}
                  onClick={() => setWhatsView("automations")}
                >
                  <MessageCircle size={17} />
                  Automações
                </button>
                <button
                  aria-pressed={whatsView === "history"}
                  onClick={() => setWhatsView("history")}
                >
                  <History size={17} />
                  Histórico de disparos
                </button>
              </nav>
              {whatsView === "history" ? (
                <WhatsAppHistory records={dispatches} />
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await onChange({
                      ...state,
                      whatsapp: { ...state.whatsDraft },
                    });
                    setFeedback("Preferências confirmadas pelo servidor.");
                  }}
                >
                  <h3>Avisos automáticos</h3>
                  <p className="finish-note">
                    Os dias de aviso valem para novas giras e atualizam os
                    lembretes ativos dos próximos encontros. Cada gira pode ter
                    o lembrete desativado. Os envios dependem do canal e dos
                    modelos oficiais.
                  </p>
                  <label className="whats-setting">
                    <span>
                      <strong>Antecedência do lembrete de gira</strong>
                      <small>Primeiro aviso antes do encontro</small>
                    </span>
                    <select
                      aria-label="Dias antes da gira"
                      value={state.whatsDraft.days}
                      onChange={async (e) =>
                        await onChange({
                          ...state,
                          whatsDraft: {
                            ...state.whatsDraft,
                            days: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option value={n} key={n}>
                          {n} {n === 1 ? "dia" : "dias"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(
                    [
                      [
                        "sameDay",
                        "Avisar no dia da gira",
                        "Adiciona um aviso no dia, além da antecedência escolhida.",
                      ],
                      [
                        "obligations",
                        "Compromissos e obrigações",
                        "Deixa o aviso ao membro ativado por padrão nos novos compromissos.",
                      ],
                      [
                        "monthly",
                        "Lembrete de mensalidade",
                        "Permite os lembretes de cobrança do serviço oficial.",
                      ],
                      [
                        "cantina",
                        "Pendências da cantina",
                        "Solicita um aviso ao registrar novo consumo em aberto na caderneta.",
                      ],
                    ] as const
                  ).map(([key, title, copy]) => (
                    <label className="whats-setting" key={key}>
                      <span>
                        <strong>{title}</strong>
                        <small>{copy}</small>
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={title}
                        checked={state.whatsDraft[key]}
                        onChange={async (e) =>
                          await onChange({
                            ...state,
                            whatsDraft: {
                              ...state.whatsDraft,
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                  <div className="settings-save">
                    <span>
                      {whatsDirty
                        ? "Preferências ainda não salvas"
                        : "Preferências consultadas no servidor"}
                    </span>
                    <div className="finish-actions">
                      <button
                        type="button"
                        className="wf-button secondary"
                        disabled={!whatsDirty}
                        onClick={async () =>
                          await onChange({
                            ...state,
                            whatsDraft: { ...state.whatsapp },
                          })
                        }
                      >
                        Descartar preferências
                      </button>
                      <button className="wf-button" disabled={!whatsDirty}>
                        Salvar automações
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="settings-access">
              <ShieldCheck size={36} />
              <h2>Acesso merece clareza.</h2>
              <p>
                Você está conectado à sua conta real. A recuperação de acesso
                usa o fluxo seguro de autenticação do sistema.
              </p>
              <dl>
                <div>
                  <dt>E-mail da conta</dt>
                  <dd>{state.profile.email}</dd>
                </div>
                <div>
                  <dt>Dados e rascunhos</dt>
                  <dd>
                    Dados confirmados permanecem no sistema; rascunhos ainda não
                    enviados ficam nesta sessão.
                  </dd>
                </div>
                <div>
                  <dt>Dados públicos</dt>
                  <dd>
                    Somente o conteúdo configurado no Radar aparece no perfil
                    público.
                  </dd>
                </div>
              </dl>
              <div className="finish-actions">
                <button
                  className="wf-button secondary"
                  onClick={() => setConfirm("access")}
                >
                  Como funcionará a recuperação?
                </button>
                <button
                  className="finish-link"
                  onClick={() => onNavigate("suporte")}
                >
                  Preciso de ajuda com meu acesso
                  <ArrowRight size={16} />
                </button>
              </div>
              {canManageCoAdmins && (
                <section style={{ marginTop: 32, padding: 24, background: "#fffdf8", borderRadius: 16, border: "1px solid #d8d0c4", boxShadow: "0 16px 36px -30px rgba(53,42,25,.7)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, padding: "16px 18px", borderRadius: 12, background: "linear-gradient(135deg,#173323,#214b35)", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ShieldCheck size={26} style={{ color: "#f4c430" }} />
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#ffffff" }}>Responsáveis pelo sistema</h3>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#d5e2d8", lineHeight: 1.5 }}>
                          Delegue a operação diária a membros de confiança sem transferir a titularidade da casa.
                        </p>
                      </div>
                    </div>
                    <span style={{ background: "rgba(244,196,48,.12)", color: "#ffe58a", border: "1px solid rgba(244,196,48,.28)", padding: "4px 10px", borderRadius: 9999, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                      Piloto controlado
                    </span>
                  </div>

                  {coAdminFeedback && (
                    <div style={{ marginBottom: 16, padding: "8px 12px", background: "#dcfce7", color: "#166534", borderRadius: 6, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={16} /> {coAdminFeedback}
                    </div>
                  )}

                  {coAdminLoading ? (
                    <p style={{ fontSize: 13, color: "#64748b" }}>Carregando responsáveis pelo sistema…</p>
                  ) : coAdmins.length === 0 ? (
                    <div style={{ padding: 18, background: "#f8f3e9", borderRadius: 12, border: "1px dashed #d8d0c4", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 13, color: "#706658", fontWeight: 600 }}>
                        Nenhum co-administrador designado no momento. Você pode designar qualquer filho de santo abrindo o perfil dele em <strong>Casa → Filhos de Santo</strong>.
                      </p>
                      <button
                        type="button"
                        className="finish-link"
                        style={{ marginTop: 10, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}
                        onClick={() => onNavigate("children")}
                      >
                        Ir para Filhos de Santo <ArrowRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {coAdmins.map((admin) => (
                        <div
                          key={admin.id}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", background: "#ffffff", borderRadius: 12, border: "1px solid #ded6ca", gap: 16 }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <strong style={{ fontSize: 14, color: "#0f172a" }}>{admin.nome}</strong>
                              <span style={{ fontSize: 10, background: "#eff7f1", color: "#17633b", border: "1px solid #c7ddcd", padding: "3px 8px", borderRadius: 999, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em" }}>
                                Acesso ativo
                              </span>
                            </div>
                            <small style={{ color: "#64748b", fontSize: 12 }}>{admin.email || "E-mail não informado"} · {summarizeCoAdminPermissions(admin.permissoes||{})}</small>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <button
                              type="button"
                              className="finish-link"
                              style={{ fontSize: 12 }}
                              onClick={() => onNavigate("children")}
                            >
                              Ver no perfil
                            </button>
                            <button
                              type="button"
                              className="finish-link danger"
                              style={{ fontSize: 12 }}
                              disabled={coAdminBusy}
                              onClick={() => setEditingPermissions(admin)}
                            >
                              Editar permissões
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p style={{ fontSize: 12, color: "#706658", marginTop: 14, marginBottom: 0, lineHeight: 1.55, fontWeight: 600 }}>
                    As permissões são individuais e podem ser alteradas ou revogadas a qualquer momento. Assinatura, cobrança do AxéCloud e exclusão permanecem exclusivas da zeladoria titular.
                  </p>
                </section>
              )}
                            <section style={{ marginTop: 24, padding: 20, borderRadius: 16, border: "1px solid #fecaca", background: "#fef2f2" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#991b1b", marginBottom: 6 }}>
                  <Trash2 size={20} />
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#991b1b" }}>
                    Zona de Perigo · Exclusão de Acesso e Conta
                  </h3>
                </div>
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "#7f1d1d", lineHeight: 1.5 }}>
                  Deseja excluir permanentemente o cadastro do terreiro e encerrar seu acesso? Esta ação apaga todos os dados (membros, financeiro, giras, mural, galeria) e o login de forma definitiva.
                </p>
                <button
                  type="button"
                  className="finish-link danger"
                  style={{ fontSize: 12, fontWeight: 700, padding: "8px 14px", background: "#fff", borderRadius: 8, border: "1px solid #fca5a5" }}
                  onClick={() => setDeleteOpen(true)}
                >
                  Excluir minha conta e dados definitivamente
                </button>
              </section>
              <section className="settings-reset">
                <h3>Descartar edições não salvas</h3>
                <p>
                  Descarta apenas as edições não enviadas. Não exclui casa,
                  conta ou arquivos do sistema.
                </p>
                <button
                  className="finish-link danger"
                  onClick={() => setConfirm("reset")}
                >
                  Descartar rascunhos das configurações
                </button>
              </section>
            </div>
          )}
        </section>
      </div>
      <HouseStateTools
        mode={mode}
        onChange={(next) => {
          setMode(next);
          setError("");
        }}
      />
      <WorkflowDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm === "access"
            ? "Recuperar acesso ao sistema"
            : confirm === "reset"
              ? "Reiniciar estas configurações?"
              : "Canal oficial de WhatsApp"
        }
        description="Informações da sua conta e das preferências da casa."
      >
        {confirm === "access" ? (
          <>
            <p>
              A recuperação usa o e-mail cadastrado e um link de uso único. A
              alteração de senha acontece no fluxo de autenticação seguro.
            </p>
            <p>
              A recuperação é feita pela página segura do sistema, com o e-mail
              da sua conta.
            </p>
            <a className="wf-button secondary" href="/recuperar-senha">
              Abrir recuperação de acesso
            </a>
          </>
        ) : (
          <>
            <p>
              {confirm === "reset"
                ? "As edições ainda não enviadas serão descartadas. Os dados salvos no sistema serão preservados."
                : "O WhatsApp usa o canal oficial gerenciado pelo AxéCloud. As preferências desta casa definem seus avisos e não desligam o canal dos outros terreiros. Se o status estiver desconectado, consulte o suporte."}
            </p>
            <div className="wf-confirm-actions">
              <button
                className="wf-button secondary"
                onClick={() => setConfirm(null)}
              >
                Voltar
              </button>
              <button className="wf-button" onClick={applyConfirm}>
                Entendi
              </button>
            </div>
          </>
        )}
      </WorkflowDialog>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} userEmail={state.profile.email} />
      <CoAdminPermissionsDialog
        member={editingPermissions?{id:editingPermissions.filho_id,name:editingPermissions.nome,email:editingPermissions.email||undefined}:null}
        existing={editingPermissions}
        busy={coAdminBusy}
        onClose={()=>setEditingPermissions(null)}
        onSave={savePermissions}
      />
    </div>
  );
}
