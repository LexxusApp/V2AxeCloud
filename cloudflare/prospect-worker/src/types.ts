/**
 * Tipos e Interfaces do Módulo Prospecção IA (AxéCloud)
 */

export type ProspectStatus =
  | 'discovered'
  | 'enriching'
  | 'analyzed'
  | 'qualified'
  | 'waiting_contact'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'demo'
  | 'trial'
  | 'customer'
  | 'not_interested'
  | 'do_not_contact'
  | 'duplicate'
  | 'invalid';

export interface ProspectingLead {
  id: string;
  terreiro_id?: string | null;
  directory_id?: string | null;
  name: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  phone_normalized?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  google_place_id?: string | null;
  source: string;
  status: ProspectStatus;
  score: number;
  ai_summary?: string | null;
  last_contact_at?: string | null;
  next_action_at?: string | null;
  whatsapp_opt_in: boolean;
  opt_in_source?: string | null;
  opt_in_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProspectingContact {
  id: string;
  lead_id: string;
  type: 'phone' | 'email' | 'whatsapp' | 'instagram' | 'form' | 'website';
  value: string;
  is_primary: boolean;
  notes?: string | null;
  created_at?: string;
}

export interface ProspectAiAnalysisResult {
  score: number; // 0-100
  summary: string;
  businessSignals: string[];
  possibleNeeds: string[];
  digitalPresence: Record<string, unknown>;
  recommendedNextAction: string;
  confidence: number; // 0-1
}

export interface ProspectingAiAnalysisRow {
  id: string;
  lead_id: string;
  score: number;
  confidence: number;
  summary: string;
  business_signals: string[];
  possible_needs: string[];
  digital_presence: Record<string, unknown>;
  recommended_next_action: string;
  raw_response: Record<string, unknown>;
  created_at?: string;
}

export interface ProspectingConversation {
  id: string;
  lead_id: string;
  channel: string;
  external_conversation_id?: string | null;
  status: 'open' | 'waiting_reply' | 'closed' | 'do_not_contact';
  last_message_at?: string | null;
  human_handoff: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProspectingMessage {
  id: string;
  conversation_id: string;
  lead_id?: string | null;
  direction: 'inbound' | 'outbound';
  body: string;
  message_type: string;
  external_id?: string | null;
  status: string;
  raw_payload?: Record<string, unknown>;
  created_at?: string;
}

export interface ProspectingEvent {
  id?: string;
  lead_id: string;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface ProspectingBlacklistEntry {
  id?: string;
  phone: string;
  reason: string;
  source: string;
  created_at?: string;
}

export interface ProspectSourceRow {
  id: string;
  code: string;
  name: string;
  provider_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface para a fila de enriquecimento
 */
export interface QueueEnrichmentMessage {
  leadId: string;
  source: string;
  priority?: number;
  timestamp: number;
}

/**
 * Interface para a fila de análise de IA
 */
export interface QueueAiAnalysisMessage {
  leadId: string;
  forceReanalyze?: boolean;
  timestamp: number;
}

/**
 * Interface para a fila de conversação / WhatsApp inbound
 */
export interface QueueConversationMessage {
  phone: string;
  inboundBody: string;
  externalId: string;
  timestamp: number;
}

/**
 * Cloudflare Worker Environment Bindings
 */
export interface ProspectingEnv {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY?: string;

  // Cloudflare Secrets / Meta API
  WA_META_TOKEN?: string;
  WA_PHONE_NUMBER_ID?: string;
  WA_BUSINESS_TOKEN_WEBHOOK?: string;
  WA_META_APP_SECRET?: string;
  WA_OPS_ALERT_PHONE_SECRET?: string;
  WA_OPS_ALERT_PHONE?: string;

  // AI
  GEMINI_API_KEY?: string;
  CLOUDFLARE_AI_GATEWAY_URL?: string;

  // Admin access
  ADMIN_CONSOLE_EMAILS?: string;
  ADMIN_EMAILS?: string;

  // Cloudflare Queues
  ENRICHMENT_QUEUE?: {
    send(message: QueueEnrichmentMessage): Promise<void>;
  };
  AI_ANALYSIS_QUEUE?: {
    send(message: QueueAiAnalysisMessage): Promise<void>;
  };
  CONVERSATION_QUEUE?: {
    send(message: QueueConversationMessage): Promise<void>;
  };
  DLQ?: {
    send(message: unknown): Promise<void>;
  };

  // Cloudflare Workflows
  DISCOVERY_WORKFLOW?: {
    create(options: { id?: string; params: Record<string, unknown> }): Promise<{ id: string }>;
  };
  LEAD_WORKFLOW?: {
    create(options: { id?: string; params: { leadId: string } }): Promise<{ id: string }>;
  };

  [key: string]: unknown;
}
