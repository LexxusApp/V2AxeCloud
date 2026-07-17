/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Flame, 
  Cloud, 
  Users, 
  Coins, 
  Calendar, 
  ShieldCheck, 
  Music, 
  Play, 
  Pause, 
  SkipForward, 
  Search, 
  Plus, 
  Heart, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Leaf, 
  Check, 
  Sparkles, 
  Trash2, 
  DollarSign, 
  Clock, 
  Menu, 
  X,
  FileText,
  Lock,
  ArrowRight,
  Info,
  ArrowLeft,
  MapPin,
  Building2,
  MessageSquare,
  Smartphone,
  QrCode,
  Wifi,
  Send,
  Radio,
  Settings,
  CheckCircle,
  User,
  Globe,
  Shield,
  Pencil,
  Phone,
  Copy,
  LogOut,
  Image as ImageIcon,
  Camera
} from 'lucide-react';

// Interfaces for our interactive demo
interface Medium {
  id: string;
  nome: string;
  cargo: string; // Ex: Médium de Desenvolvimento, Babalaô, Ogã, Cambone, Mãe de Santo
  orixaPai: string;
  orixaMae: string;
  guiaEspiritual: string;
  status: 'Ativo' | 'Afastado' | 'Em Obrigação';
  avatarColor: string;
  
  // Extended fields for the redesigned member/filho de santo profile card
  matricula?: string;
  dataNascimento?: string;
  cpf?: string;
  endereco?: string;
  whatsapp?: string;
  vinculoUsuario?: string;
  orixaFrente?: string;
  adjunto?: string;
  dataEntrada?: string;
  dataFeitura?: string;
  quizilas?: string;
  obligacoes?: { id: string; nome: string; status: 'Pendente' | 'Concluído'; data?: string }[];
  historicoFinanceiro?: { mes: string; status: 'PG' | 'Aberto' | 'Atraso'; valor: number }[];
  anotacoesZeladoria?: { id: string; data: string; texto: string; autor: string }[];
}

interface Lancamento {
  id: string;
  descricao: string;
  tipo: 'Entrada' | 'Saída';
  valor: number;
  categoria: string; // Mensalidade, Festa, Velas, Ervas, Manutenção
  data: string;
}

interface GiraEvent {
  id: string;
  nome: string;
  tipo: string; // Linha de Trabalho (Caboclo, Exu, Pretos Velhos)
  data: string;
  horario: string;
  status: 'Confirmada' | 'Especial' | 'Concluída';
}

interface PontoCantado {
  id: string;
  titulo: string;
  entidade: string;
  linha: string;
  letra: string[];
  audioSimulatedUrl?: string;
}

interface PrayerChatMessage {
  id: string;
  sender: 'Zelador' | 'Visitante';
  text: string;
  time: string;
}

interface PrayerRequest {
  id: string;
  solicitante: string;
  casa: string;
  categoria: string;
  linha: string;
  vela: 'Branca' | 'Vermelha' | 'Azul' | 'Verde' | 'Amarela' | 'Preta' | 'Nenhuma';
  status: 'Pendente' | 'Aceito' | 'Em Oração';
  intencao: string;
  data: string;
  chatMessages: PrayerChatMessage[];
}

interface TerreiroHouse {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  endereco: string;
  telefone: string;
}

const CASAS_PARCEIRAS: TerreiroHouse[] = [
  { id: 'casa-1', nome: 'Terreiro Caboclo Ventania', cidade: 'São Paulo', estado: 'SP', endereco: 'Rua das Almas, 140 - Jabaquara', telefone: '(11) 98765-4321' },
  { id: 'casa-2', nome: 'Centro Espiritual Luz de Aruanda', cidade: 'Rio de Janeiro', estado: 'RJ', endereco: 'Av. Copacabana, 820 - Copacabana', telefone: '(21) 97765-1122' },
  { id: 'casa-3', nome: 'Templo da Estrela D\'Alva', cidade: 'Salvador', estado: 'BA', endereco: 'Rua do Bonfim, 45 - Bonfim', telefone: '(71) 96123-4567' },
  { id: 'casa-4', nome: 'Cabana de Pai Joaquim', cidade: 'Belo Horizonte', estado: 'MG', endereco: 'Rua dos Inconfidentes, 210 - Savassi', telefone: '(31) 99888-7766' },
  { id: 'casa-5', nome: 'Ylê Axé Oxalá e Yemanjá', cidade: 'São Paulo', estado: 'SP', endereco: 'Av. Paulista, 2400 - Bela Vista', telefone: '(11) 95555-4444' },
  { id: 'casa-6', nome: 'Terreiro Vovó Maria Conga', cidade: 'Curitiba', estado: 'PR', endereco: 'Rua XV de Novembro, 1050 - Centro', telefone: '(41) 94444-3333' },
  { id: 'casa-7', nome: 'Centro de Caridade Caboclo Ogum Beira-Mar', cidade: 'Rio de Janeiro', estado: 'RJ', endereco: 'Estrada do Galeão, 340 - Ilha do Governador', telefone: '(21) 92222-1111' },
  { id: 'casa-8', nome: 'Abassá de Ogum', cidade: 'Porto Alegre', estado: 'RS', endereco: 'Av. Ipiranga, 450 - Praia de Belas', telefone: '(51) 93333-2222' }
];

export default function App() {
  // Mobile menu control
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Página Atual: 'landing' para o site institucional, 'fiel' para o espaço do de oração público/visitante
  const [currentPage, setCurrentPage] = useState<'landing' | 'fiel'>('landing');
  const [selectedCity, setSelectedCity] = useState<string>('Todas');

  const handleNavClick = (sectionId: string, page: 'landing' | 'fiel' = 'landing') => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  // General Notification System for interactive actions
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  
  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // State for the Live Interactive Demo Dashboard
  const [activeDashboardTab, setActiveDashboardTab] = useState<'inicio' | 'mediums' | 'financeiro' | 'giras' | 'pontos' | 'reza' | 'whatsapp' | 'configuracoes' | 'galeria'>('inicio');

  // Galeria de Lembranças & Álbuns de Fotos
  interface GalleryPhoto {
    id: string;
    url: string;
    titulo: string;
    legenda: string;
    data: string;
    autor: string;
    categoria: 'gira' | 'evento' | 'lembranca';
    likes?: number;
  }

  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([
    {
      id: 'photo-1',
      url: 'https://images.unsplash.com/photo-1545239351-ef35f43d514b?auto=format&fit=crop&q=80&w=600',
      titulo: 'Amaci e Firmamento de Cabeça',
      legenda: 'Trabalho de fortalecimento com ervas de Ogum no Congá Sagrado. Vibração pura de axé.',
      data: '23/04/2026',
      autor: 'Pai Alexandre de Ogum',
      categoria: 'gira'
    },
    {
      id: 'photo-2',
      url: 'https://images.unsplash.com/photo-1606293926075-69a00dbf2972?auto=format&fit=crop&q=80&w=600',
      titulo: 'Colheita na Mata de Oxóssi',
      legenda: 'Filhos de santo em missão de colheita para preceitos das obrigações anuais.',
      data: '15/05/2026',
      autor: 'Mãe Silvana de Oxum',
      categoria: 'lembranca'
    },
    {
      id: 'photo-3',
      url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&q=80&w=600',
      titulo: 'Lágrimas e Sorrisos Litúrgicos',
      legenda: 'Um registro singelo de paz no encerramento da Corrente do Humaitá Luz do Amanhã.',
      data: '12/12/2025',
      autor: 'Pai Alexandre de Ogum',
      categoria: 'evento'
    },
    {
      id: 'photo-4',
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=600',
      titulo: 'Oferendas de Iemanjá',
      legenda: 'Ritual anual na praia entregando flores brancas e perfumes para a Rainha das Ondas.',
      data: '02/02/2026',
      autor: 'Pai Alexandre de Ogum',
      categoria: 'evento'
    }
  ]);

  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoTitulo, setNewPhotoTitulo] = useState('');
  const [newPhotoLegenda, setNewPhotoLegenda] = useState('');
  const [newPhotoCategoria, setNewPhotoCategoria] = useState<'gira' | 'evento' | 'lembranca'>('gira');
  const [activeGalleryFilter, setActiveGalleryFilter] = useState<'tudo' | 'gira' | 'evento' | 'lembranca'>('tudo');

  // Zelador & Terreiro Configuration (Interactive Demo)
  const [profileName, setProfileName] = useState('Pai Alexandre de Ogum');
  const [profileTerreiro, setProfileTerreiro] = useState('Humaitá Luz do Amanhã');
  const [profileCargo, setProfileCargo] = useState('Zelador de Santo (Pai de Santo)');
  const [profileFoto, setProfileFoto] = useState('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256'); // Elegant preset portrait
  
  // Sub-menu state for Configurações
  const [configSubTab, setConfigSubTab] = useState<'perfil' | 'religioso' | 'plataforma'>('perfil');

  // Estados de Configuração de WhatsApp e Notificações (Demo Interativa)
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [whatsappConnecting, setWhatsappConnecting] = useState(false);
  const [whatsappQR, setWhatsappQR] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('(11) 99999-8888');
  const [whatsappPreferences, setWhatsappPreferences] = useState({
    notifGiras: true,
    notifFinanceiro: true,
    notifReza: true,
    notifAniversarios: true,
  });
  const [whatsappTestMessage, setWhatsappTestMessage] = useState('⚠️ Comunicado do Terreiro: Salve a Corrente! Lembra-se que hoje nossa sessão inicia às 20:00 com passe e descarrego. Aguardamos todos na curimba!');
  const [whatsappLogs, setWhatsappLogs] = useState<Array<{
    id: string;
    destino: string;
    mensagem: string;
    data: string;
    tipo: 'gira' | 'financeiro' | 'reza' | 'teste';
    status: 'Enviado' | 'Falha';
  }>>([
    {
      id: 'wlog-1',
      destino: 'Corrente Geral (34 médiuns)',
      data: 'Hoje às 09:12',
      tipo: 'gira',
      mensagem: '📅 CONVOCAÇÃO LITÚRGICA: Hoje teremos Gira de Caboclos e Pretos Velhos às 20:00. Defumação inicia 15 minutos antes. Uso obrigatório de guias branca e vermelha. Axé!',
      status: 'Enviado'
    },
    {
      id: 'wlog-2',
      destino: 'Mário de Ogum (Cambone)',
      data: 'Ontem às 18:41',
      tipo: 'financeiro',
      mensagem: '💰 REGISTRO DE MENSALIDADE: Olá Mário, seu pagamento da mensalidade de R$ 80,00 foi compensado em nosso caixa hoje. Prontidão e amparo ao terreiro!',
      status: 'Enviado'
    },
    {
      id: 'wlog-3',
      destino: 'Ana de Iemanjá (Visitante)',
      data: '08/06/2026 às 15:20',
      tipo: 'reza',
      mensagem: '🕯️ ALTA VIRTUAL: Salve a Corrente de Luz, Ana! Seu pedido de reza por sua irmã Carmen foi recebido pelo Zelador e a luz já corre no Congá.',
      status: 'Enviado'
    }
  ]);

  const triggerWhatsappLog = (destino: string, mensagem: string, tipo: 'gira' | 'financeiro' | 'reza' | 'teste') => {
    const timeStr = new Date().toLocaleTimeString().substring(0, 5);
    const newLog = {
      id: 'wlog-' + Date.now().toString(),
      destino,
      mensagem,
      data: `Hoje às ${timeStr}`,
      tipo,
      status: 'Enviado' as const
    };
    setWhatsappLogs(prev => [newLog, ...prev]);
  };

  // 1.1 Prayer (Reza) System States
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>([
    {
      id: 'pr-1',
      solicitante: 'Carlos de Souza',
      casa: 'Terreiro Caboclo Ventania',
      categoria: 'Saúde',
      linha: 'Pretos Velhos / Almas',
      vela: 'Branca',
      status: 'Aceito',
      intencao: 'Peço saúde e paz de espírito para minha mãe de 74 anos que está em recuperação de uma cirurgia cardíaca.',
      data: '2026-06-08 14:30',
      chatMessages: [
        { id: 'm1', sender: 'Visitante', text: 'Olá Zelador, gostaria de pedir uma reza especial para minha mãe.', time: '14:30' },
        { id: 'm2', sender: 'Zelador', text: 'Saravá, meu irmão Carlos. O pedido foi aceito. Já firmamos a vela branca e incluímos o nome dela em nossa corrente de oração com os Pretos Velhos.', time: '15:12' }
      ]
    },
    {
      id: 'pr-2',
      solicitante: 'Juliana Mendes',
      casa: 'Terreiro Caboclo Ventania',
      categoria: 'Proteção',
      linha: 'Caboclos',
      vela: 'Vermelha',
      status: 'Pendente',
      intencao: 'Abertura de caminhos profissionais e proteção no novo emprego, pois ando sentindo muito peso nas costas e cansaço excessivo.',
      data: '2026-06-09 01:10',
      chatMessages: [
        { id: 'm3', sender: 'Visitante', text: 'Tenho me sentido muito cansada ultimamente no trabalho. Peço auxílio de Ogum.', time: '01:10' }
      ]
    },
    {
      id: 'pr-3',
      solicitante: 'Ricardo Amaro',
      casa: 'Templo da Estrela D\'Alva',
      categoria: 'Limpeza Espiritual',
      linha: 'Pretos Velhos / Almas',
      vela: 'Branca',
      status: 'Pendente',
      intencao: 'Descarrego de energias negativas acumuladas no meu lar após visitas problemáticas.',
      data: '2026-06-09 02:00',
      chatMessages: [
        { id: 'm4', sender: 'Visitante', text: 'Peço descarrego urgente de energias pesadas na minha residência.', time: '02:00' }
      ]
    }
  ]);

  const [newPrayerRequest, setNewPrayerRequest] = useState({
    solicitante: '',
    casa: 'Terreiro Caboclo Ventania',
    categoria: 'Proteção',
    linha: 'Caboclos',
    vela: 'Branca' as 'Branca' | 'Vermelha' | 'Azul' | 'Verde' | 'Amarela' | 'Preta' | 'Nenhuma',
    intencao: ''
  });

  const [selectedPrayerId, setSelectedPrayerId] = useState<string>('pr-2');
  const [chatInputText, setChatInputText] = useState('');
  const [activePerspective, setActivePerspective] = useState<'zelador' | 'visitante'>('zelador');
  const [userRole, setUserRole] = useState<'zelador' | 'filho'>('zelador');
  const [isDemoLoggedIn, setIsDemoLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('pai.alexandre@cabocloventania.org');
  const [loginPassword, setLoginPassword] = useState('123456');
  const [comunicados, setComunicados] = useState<Array<{ id: string; data: string; titulo: string; categoria: string; texto: string; autor: string }>>([
    {
      id: 'com-1',
      data: '2026-06-11',
      titulo: '⚠️ Preceitos para Gira Especial de Xangô',
      categoria: 'Preceito',
      texto: 'Salve a Corrente de Luz! Para nossa louvação a Xangô no dia 20/06, o resguardo ritual começa 24h antes dos trabalhos (recomenda-se evitar carnes pesadas, bebidas alcóolicas e preceitos de recolhimento). Tragam velas brancas e marrons para firmar no Congá comunitário.',
      autor: 'Pai Alexandre'
    },
    {
      id: 'com-2',
      data: '2026-06-08',
      titulo: '💰 Atualização da Tesouraria e Mensalidades',
      categoria: 'Financeiro',
      texto: 'Informamos a toda a corrente de filhos de santo que a contribuição de Junho já está em aberto nas fichas de tesouraria. As guias de arrecadação deste ciclo serão aplicadas na impermeabilização do telhado da curimba e reposição de velas aromáticas do terreiro.',
      autor: 'Pai Alexandre'
    },
    {
      id: 'com-3',
      data: '2026-06-05',
      titulo: '🌿 Campanha Sanitária de Ervas e Mutirão',
      categoria: 'Geral',
      texto: 'No próximo sábado, às 08:30 da manhã, faremos um mutirão de colheita e secagem de guiné, alecrim e arruda em nosso sítio litúrgico. Quem puder participar com foices ou tesouras esterilizadas, por favor coordenar com a cambonagem geral.',
      autor: 'Pai Alexandre'
    }
  ]);
  const [newComunicado, setNewComunicado] = useState({ titulo: '', categoria: 'Geral', texto: '' });

  const handleAddPrayerRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrayerRequest.solicitante.trim() || !newPrayerRequest.intencao.trim()) {
      showNotification('Por favor, preencha seu nome e intenção de oração.', 'error');
      return;
    }

    const newRequest: PrayerRequest = {
      id: 'pr-' + Date.now().toString(),
      solicitante: newPrayerRequest.solicitante,
      casa: newPrayerRequest.casa,
      categoria: newPrayerRequest.categoria,
      linha: newPrayerRequest.linha,
      vela: newPrayerRequest.vela,
      status: 'Pendente',
      intencao: newPrayerRequest.intencao,
      data: new Date().toISOString().replace('T', ' ').substring(0, 16),
      chatMessages: [
        {
          id: 'msg-' + Date.now().toString(),
          sender: 'Visitante',
          text: newPrayerRequest.intencao,
          time: new Date().toLocaleTimeString().substring(0, 5)
        }
      ]
    };

    setPrayerRequests([newRequest, ...prayerRequests]);
    setSelectedPrayerId(newRequest.id);
    setNewPrayerRequest({
      solicitante: '',
      casa: 'Terreiro Caboclo Ventania',
      categoria: 'Proteção',
      linha: 'Caboclos',
      vela: 'Branca',
      intencao: ''
    });
    
    showNotification(`Seu pedido foi registrado para a casa "${newRequest.casa}"! Mude para o modo Zelador para gerenciá-lo.`, 'success');
  };

  const handleSendChatMessage = (sender: 'Zelador' | 'Visitante') => {
    if (!chatInputText.trim()) return;

    setPrayerRequests(prevRequests => {
      return prevRequests.map(req => {
        if (req.id === selectedPrayerId) {
          return {
            ...req,
            chatMessages: [
              ...req.chatMessages,
              {
                id: 'm-' + Date.now().toString(),
                sender: sender,
                text: chatInputText,
                time: new Date().toLocaleTimeString().substring(0, 5)
              }
            ]
          };
        }
        return req;
      });
    });

    setChatInputText('');
    showNotification('Mensagem enviada com sucesso no chat!');
  };

  const handleUpdatePrayerStatus = (id: string, newStatus: 'Aceito' | 'Em Oração') => {
    setPrayerRequests(prevRequests => {
      return prevRequests.map(req => {
        if (req.id === id) {
          const updatedReq = { ...req, status: newStatus };
          // Auto system message about the status change
          const systemMsg: PrayerChatMessage = {
            id: 'm-sys-' + Date.now().toString(),
            sender: 'Zelador',
            text: newStatus === 'Aceito' 
              ? `Saravá! O Zelador aceitou seu pedido e firmou uma vela ${req.vela} em nossa Corrente de Luz.` 
              : `A Corrente Espiritual da casa está direcionando orações neste exato momento para a Linha de ${req.linha}. Sintonize seus pensamentos!`,
            time: new Date().toLocaleTimeString().substring(0, 5)
          };
          updatedReq.chatMessages = [...updatedReq.chatMessages, systemMsg];
          return updatedReq;
        }
        return req;
      });
    });

    showNotification(
      newStatus === 'Aceito' 
        ? 'Pedido aceito e vela virtual firmada com sucesso!' 
        : 'Sessão de oração ativa iniciada para esta intenção!'
    );

    // Envio de notificação simulada automatizada por WhatsApp ao fiel/destinatário
    if (whatsappConnected && whatsappPreferences.notifReza) {
      const selectedReq = prayerRequests.find(r => r.id === id);
      if (selectedReq) {
        const textMsg = newStatus === 'Aceito'
          ? `🕯️ ALTA VIRTUAL: Olá ${selectedReq.solicitante}, seu pedido de reza na categoria [${selectedReq.categoria}] foi aceito pelo Zelador e a vela virtual ${selectedReq.vela} foi firmada em nossa Corrente de Luz!`
          : `🌿 CORRENTE ATIVA: Olá ${selectedReq.solicitante}, a corrente de oração de ${selectedReq.linha} está ativa neste momento para amparar suas intenções. Mentalize paz!`;
        triggerWhatsappLog(`${selectedReq.solicitante} (Fiel/Visitante)`, textMsg, 'reza');
      }
    }
  };

  // 1.2 Public Visitor Prayer States and Handlers (Real Space)
  const [publicPrayerRequest, setPublicPrayerRequest] = useState({
    solicitante: '',
    casa: 'Terreiro Caboclo Ventania',
    categoria: 'Proteção / Defesa Espiritual',
    linha: 'Caboclos',
    vela: 'Branca' as 'Branca' | 'Vermelha' | 'Azul' | 'Verde' | 'Amarela' | 'Preta' | 'Nenhuma',
    intencao: ''
  });
  const [publicSelectedId, setPublicSelectedId] = useState<string>('pr-2');
  const [publicChatInput, setPublicChatInput] = useState('');

  const handleAddPublicPrayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicPrayerRequest.solicitante.trim() || !publicPrayerRequest.intencao.trim()) {
      showNotification('Por favor, preencha o nome de quem solicita e a intenção de oração.', 'error');
      return;
    }

    const newRequest: PrayerRequest = {
      id: 'pr-' + Date.now().toString(),
      solicitante: publicPrayerRequest.solicitante,
      casa: publicPrayerRequest.casa,
      categoria: publicPrayerRequest.categoria,
      linha: publicPrayerRequest.linha,
      vela: publicPrayerRequest.vela,
      status: 'Pendente',
      intencao: publicPrayerRequest.intencao,
      data: new Date().toISOString().replace('T', ' ').substring(0, 16),
      chatMessages: [
        {
          id: 'msg-' + Date.now().toString(),
          sender: 'Visitante',
          text: publicPrayerRequest.intencao,
          time: new Date().toLocaleTimeString().substring(0, 5)
        }
      ]
    };

    setPrayerRequests([newRequest, ...prayerRequests]);
    setPublicSelectedId(newRequest.id);
    setSelectedPrayerId(newRequest.id); // Also select in control panel for easy testing sync
    
    setPublicPrayerRequest({
      solicitante: '',
      casa: 'Terreiro Caboclo Ventania',
      categoria: 'Proteção / Defesa Espiritual',
      linha: 'Caboclos',
      vela: 'Branca',
      intencao: ''
    });

    showNotification(`Seu pedido foi registrado na casa "${newRequest.casa}" com sucesso! Acompanhe o Altar Virtual na coluna ao lado.`, 'success');
  };

  const handleSendPublicChatMessage = () => {
    if (!publicChatInput.trim()) return;

    setPrayerRequests(prevRequests => {
      return prevRequests.map(req => {
        if (req.id === publicSelectedId) {
          return {
            ...req,
            chatMessages: [
              ...req.chatMessages,
              {
                id: 'm-' + Date.now().toString(),
                sender: 'Visitante',
                text: publicChatInput,
                time: new Date().toLocaleTimeString().substring(0, 5)
              }
            ]
          };
        }
        return req;
      });
    });

    setPublicChatInput('');
    showNotification('Mensagem enviada com sucesso no chat do altar!');
  };
  
  // 1. Mediums State & Mock Data (Extended with detailed fields)
  const [mediums, setMediums] = useState<Medium[]>([
    {
      id: '6',
      nome: 'Lucas Augusto',
      cargo: 'Ogã (Tocador)',
      orixaPai: 'Azansu',
      orixaMae: 'Nanã',
      guiaEspiritual: 'Preto Velho Pai Joaquim',
      status: 'Ativo',
      avatarColor: 'bg-amber-500/20 text-[#FACC15] border border-[#FACC15]/30',
      matricula: 'AXC-2021-352B',
      dataNascimento: '03/06/1994',
      cpf: '41938545826',
      endereco: 'Aguardando preenchimento',
      whatsapp: 'Aguardando preenchimento',
      vinculoUsuario: 'a3112f98-9384-4f04-a922-24e19deaf0ea',
      orixaFrente: 'Azansu',
      adjunto: 'Aguardando preenchimento',
      dataEntrada: '02/01/2021',
      dataFeitura: 'Aguardando preenchimento',
      quizilas: 'Aguardando preenchimento',
      obligacoes: [
        { id: 'ob1', nome: 'Amaci do Ogã', status: 'Concluído', data: '15/01/2021' },
        { id: 'ob2', nome: 'Obrigação de 1 Ano de Atabaque', status: 'Concluído', data: '10/01/2022' },
        { id: 'ob3', nome: 'Obrigação de 3 Anos da Curimba', status: 'Concluído', data: '12/01/2024' },
        { id: 'ob4', nome: 'Confirmação Geral de Ogã Sacerdotal', status: 'Pendente' }
      ],
      historicoFinanceiro: [
        { mes: 'Janeiro / 2026', status: 'PG', valor: 100 },
        { mes: 'Fevereiro / 2026', status: 'PG', valor: 100 },
        { mes: 'Março / 2026', status: 'PG', valor: 100 },
        { mes: 'Abril / 2026', status: 'PG', valor: 100 },
        { mes: 'Maio / 2026', status: 'Aberto', valor: 100 }
      ],
      anotacoesZeladoria: [
        { id: 'an1', data: '10/11/2025', texto: 'Demonstrou incrível precisão e toque ritualístico no Louvação ao Orixá Obaluaiê.', autor: 'Pai Alexandre' },
        { id: 'an2', data: '14/04/2026', texto: 'Apoio inestimável na manutenção do Congá e preceitos litúrgicos.', autor: 'Pai Alexandre' }
      ]
    },
    {
      id: '1',
      nome: 'Mariana de Iansã',
      cargo: 'Médium de Desenvolvimento',
      orixaPai: 'Xangô',
      orixaMae: 'Iansã',
      guiaEspiritual: 'Caboclo Ventania',
      status: 'Ativo',
      avatarColor: 'bg-amber-100 text-amber-800',
      matricula: 'AXC-2022-812C',
      dataNascimento: '14/05/1991',
      cpf: '31289148201',
      endereco: 'Rua das Flores, 412 - São Paulo SP',
      whatsapp: '(11) 98765-4321',
      vinculoUsuario: 'b112f458-1234-5f04-a122-12e12deaf011',
      orixaFrente: 'Iansã',
      adjunto: 'Xangô',
      dataEntrada: '10/05/2022',
      dataFeitura: 'Aguardando preenchimento',
      quizilas: 'Carne de Corco, folha de mangueira',
      obligacoes: [
        { id: 'ob1', nome: 'Amaci de Entrada', status: 'Concluído', data: '12/05/2022' },
        { id: 'ob2', nome: 'Obrigação de 1 Ano', status: 'Concluído', data: '15/05/2023' },
        { id: 'ob3', nome: 'Obrigação de 3 Anos de Corrente', status: 'Pendente' }
      ],
      historicoFinanceiro: [
        { mes: 'Janeiro / 2026', status: 'PG', valor: 80 },
        { mes: 'Fevereiro / 2026', status: 'PG', valor: 80 },
        { mes: 'Março / 2026', status: 'Aberto', valor: 80 }
      ],
      anotacoesZeladoria: [
        { id: 'an1', data: '22/01/2026', texto: 'Médium muito dedicada ao desenvolvimento. Mostrou ótimo progresso na incorporação.', autor: 'Pai Alexandre' }
      ]
    },
    {
      id: '2',
      nome: 'Pai Alexandre de Ogum',
      cargo: 'Zelador de Santo (Pai de Santo)',
      orixaPai: 'Ogum',
      orixaMae: 'Yemanjá',
      guiaEspiritual: 'Caboclo Sete Flechas',
      status: 'Ativo',
      avatarColor: 'bg-blue-100 text-blue-800',
      matricula: 'AXC-2015-001A',
      dataNascimento: '12/10/1975',
      cpf: '12345678912',
      endereco: 'Avenida Sacerdotal, 12',
      whatsapp: '(11) 91234-5678',
      vinculoUsuario: 'ccc122ee-ffff-4444-8888-0000aaaa1111',
      orixaFrente: 'Ogum',
      adjunto: 'Yemanjá',
      dataEntrada: '15/11/2012',
      dataFeitura: '15/11/2015',
      quizilas: 'Mel e azeite em determinados dias de preceito',
      obligacoes: [
        { id: 'ob1', nome: 'Feitura de Santo / Coroação', status: 'Concluído', data: '15/11/2015' },
        { id: 'ob2', nome: 'Obrigação de 7 Anos', status: 'Concluído', data: '15/11/2022' }
      ],
      historicoFinanceiro: [
        { mes: 'Janeiro / 2026', status: 'PG', valor: 0 },
        { mes: 'Fevereiro / 2026', status: 'PG', valor: 0 }
      ],
      anotacoesZeladoria: [
        { id: 'an1', data: '01/01/2026', texto: 'Dirigente e fundador do Terreiro.', autor: 'Sistema Executivo' }
      ]
    },
    {
      id: '3',
      nome: 'Vinícius do Atabaque',
      cargo: 'Ogã (Tocador)',
      orixaPai: 'Oxóssi',
      orixaMae: 'Oxum',
      guiaEspiritual: 'Preto Velho Pai Joaquim',
      status: 'Ativo',
      avatarColor: 'bg-emerald-100 text-emerald-800',
      matricula: 'AXC-2023-455X',
      dataNascimento: '19/11/1998',
      cpf: '45678912345',
      endereco: 'Viela do Ritmo, 10',
      whatsapp: '(11) 99876-5432',
      vinculoUsuario: 'd334e211-1234-5a4a-1122-334455667788',
      orixaFrente: 'Oxóssi',
      adjunto: 'Oxum',
      dataEntrada: '01/03/2023',
      dataFeitura: 'Aguardando preenchimento',
      quizilas: 'Banana nanica, peixe de água salgada',
      obligacoes: [
        { id: 'ob1', nome: 'Confirmando Toque Caboclo', status: 'Concluído', data: '15/04/2023' }
      ],
      historicoFinanceiro: [
        { mes: 'Janeiro / 2026', status: 'PG', valor: 80 }
      ],
      anotacoesZeladoria: []
    },
    {
      id: '4',
      nome: 'Clara de Oxum',
      cargo: 'Cambone (Auxiliar)',
      orixaPai: 'Oxalá',
      orixaMae: 'Oxum',
      guiaEspiritual: 'Cabocla Jurema',
      status: 'Em Obrigação',
      avatarColor: 'bg-yellow-100 text-yellow-800',
      matricula: 'AXC-2024-112G',
      dataNascimento: '25/12/2001',
      cpf: '98765432101',
      endereco: 'Aguardando preenchimento',
      whatsapp: '(11) 91111-2222',
      vinculoUsuario: 'e221a998-efef-1212-aaaa-555566667777',
      orixaFrente: 'Oxum',
      adjunto: 'Oxalá',
      dataEntrada: '14/01/2024',
      dataFeitura: 'Aguardando preenchimento',
      quizilas: 'Ouriço de metal, coco seco',
      obligacoes: [
        { id: 'ob1', nome: 'Vassoura de Cambone', status: 'Concluído', data: '20/01/2024' }
      ],
      historicoFinanceiro: [
        { mes: 'Janeiro / 2026', status: 'PG', valor: 80 }
      ],
      anotacoesZeladoria: []
    },
    {
      id: '5',
      nome: 'Roberto de Obaluaiê',
      cargo: 'Médium Iniciante',
      orixaPai: 'Obaluaiê',
      orixaMae: 'Nanã',
      guiaEspiritual: 'Baiano Zé do Coco',
      status: 'Afastado',
      avatarColor: 'bg-violet-100 text-violet-800',
      matricula: 'AXC-2022-771H',
      dataNascimento: '08/08/1987',
      cpf: '77218391201',
      endereco: 'Aguardando preenchimento',
      whatsapp: 'Aguardando preenchimento',
      vinculoUsuario: 'f321b111-dada-e1e1-cccc-bbbb11112222',
      orixaFrente: 'Obaluaiê',
      adjunto: 'Nanã',
      dataEntrada: '15/09/2022',
      dataFeitura: 'Aguardando preenchimento',
      quizilas: 'Folha de bananeira morta',
      obligacoes: [],
      historicoFinanceiro: [],
      anotacoesZeladoria: []
    }
  ]);

  const [selectedMedium, setSelectedMedium] = useState<Medium | null>(null);
  const [mediumProfileTab, setMediumProfileTab] = useState<'info' | 'obrigacao' | 'financeiro' | 'notas'>('info');
  const [isEditingMediumProfile, setIsEditingMediumProfile] = useState(false);
  const [newProfileNote, setNewProfileNote] = useState('');

  const [searchMedium, setSearchMedium] = useState('');
  const [newMedium, setNewMedium] = useState({
    nome: '',
    cargo: 'Médium de Desenvolvimento',
    orixaPai: 'Ogum',
    orixaMae: 'Oxum',
    guiaEspiritual: '',
    status: 'Ativo' as 'Ativo' | 'Afastado' | 'Em Obrigação',
  });

  const handleAddMedium = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedium.nome.trim()) {
      showNotification('Por favor, informe o nome do médium.', 'error');
      return;
    }
    const colors = [
      'bg-red-100 text-red-800',
      'bg-blue-100 text-blue-800',
      'bg-amber-100 text-amber-800',
      'bg-emerald-100 text-emerald-800',
      'bg-rose-100 text-rose-800',
      'bg-sky-100 text-sky-800'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const saved: Medium = {
      id: Date.now().toString(),
      nome: newMedium.nome,
      cargo: newMedium.cargo,
      orixaPai: newMedium.orixaPai,
      orixaMae: newMedium.orixaMae,
      guiaEspiritual: newMedium.guiaEspiritual || 'Em Desenvolvimento',
      status: newMedium.status,
      avatarColor: randomColor,
    };
    setMediums([saved, ...mediums]);
    setNewMedium({
      nome: '',
      cargo: 'Médium de Desenvolvimento',
      orixaPai: 'Ogum',
      orixaMae: 'Oxum',
      guiaEspiritual: '',
      status: 'Ativo',
    });
    showNotification(`Médium ${saved.nome} cadastrado com sucesso!`);
  };

  const handleDeleteMedium = (id: string, name: string) => {
    setMediums(mediums.filter(m => m.id !== id));
    showNotification(`Removido: ${name}`, 'info');
  };

  // 2. Financeiro State & Mock Data
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([
    { id: '1', descricao: 'Mensalidades do Corpo Mediúnico (Junho)', tipo: 'Entrada', valor: 650.00, categoria: 'Mensalidade', data: '2026-06-05' },
    { id: '2', descricao: 'Compra de Velas Brancas e Coloridas (Caixa)', tipo: 'Saída', valor: 145.20, categoria: 'Velas', data: '2026-06-04' },
    { id: '3', descricao: 'Doação de Flores para Festa de Iemanjá', tipo: 'Entrada', valor: 250.00, categoria: 'Festa', data: '2026-06-02' },
    { id: '4', descricao: 'Ervas frescas compradas no Mercado Central', tipo: 'Saída', valor: 89.90, categoria: 'Ervas', data: '2026-06-01' },
    { id: '5', descricao: 'Manutenção do Telhado do Congá (Madeira)', tipo: 'Saída', valor: 320.00, categoria: 'Manutenção', data: '2026-05-28' },
  ]);
  const [newLancamento, setNewLancamento] = useState({
    descricao: '',
    tipo: 'Entrada' as 'Entrada' | 'Saída',
    valor: '',
    categoria: 'Mensalidade'
  });

  const handleAddLancamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLancamento.descricao.trim() || !newLancamento.valor) {
      showNotification('Por favor, preencha a descrição e o valor.', 'error');
      return;
    }
    const valorNum = parseFloat(newLancamento.valor);
    if (isNaN(valorNum) || valorNum <= 0) {
      showNotification('Valor inválido.', 'error');
      return;
    }
    const saved: Lancamento = {
      id: Date.now().toString(),
      descricao: newLancamento.descricao,
      tipo: newLancamento.tipo,
      valor: valorNum,
      categoria: newLancamento.categoria,
      data: new Date().toISOString().split('T')[0]
    };
    setLancamentos([saved, ...lancamentos]);
    setNewLancamento({
      descricao: '',
      tipo: 'Entrada',
      valor: '',
      categoria: 'Mensalidade'
    });
    showNotification(`Lançamento "${saved.descricao}" registrado em tempo real!`);

    // Notificação do WhatsApp do Financeiro de forma automatizada
    if (whatsappConnected && whatsappPreferences.notifFinanceiro) {
      const targetName = saved.descricao.includes('mensalidade') 
        ? saved.descricao.replace(/mensalidade|de/gi, '').trim() || 'Médium da Corrente'
        : 'Médium / Filha de Santo';
      const textMsg = `💰 COMPROVANTE ENVIADO: Olá! Registramos um fluxo financeiro de *R$ ${saved.valor.toFixed(2)}* referente à categoria *${saved.categoria}* (${saved.descricao}) em nosso caixa. Agradecemos pelo amparo litúrgico e apoio à casa. Axé!`;
      triggerWhatsappLog(`${targetName} (Médium)`, textMsg, 'financeiro');
    }
  };

  const handleDeleteLancamento = (id: string, label: string) => {
    setLancamentos(lancamentos.filter(l => l.id !== id));
    showNotification(`Lançamento "${label}" excluído.`, 'info');
  };

  const totalEntradas = lancamentos.filter(l => l.tipo === 'Entrada').reduce((acc, current) => acc + current.valor, 0);
  const totalSaidas = lancamentos.filter(l => l.tipo === 'Saída').reduce((acc, current) => acc + current.valor, 0);
  const totalCaixa = totalEntradas - totalSaidas;

  // 3. Giras Calendar State & Mock Data
  const [giras, setGiras] = useState<GiraEvent[]>([
    { id: '1', nome: 'Gira de Baianos e Boiadeiros', tipo: 'Normal', data: '2026-06-09', horario: '20:00', status: 'Confirmada' },
    { id: '2', nome: 'Louvação Anual e Homenagem a Xangô', tipo: 'Festa Pública', data: '2026-06-20', horario: '19:00', status: 'Especial' },
    { id: '3', nome: 'Gira de Caboclos e Pretos Velhos', tipo: 'Caridade', data: '2026-06-23', horario: '20:00', status: 'Confirmada' },
    { id: '4', nome: 'Trabalho de Esquerda (Exus e Pombagiras)', tipo: 'Fechada', data: '2026-06-30', horario: '21:00', status: 'Confirmada' },
  ]);
  const [newGira, setNewGira] = useState({
    nome: '',
    tipo: 'Normal',
    data: '',
    horario: '20:00',
    status: 'Confirmada' as 'Confirmada' | 'Especial'
  });

  const handleAddGira = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGira.nome.trim() || !newGira.data) {
      showNotification('Indique o nome da sessão e a data.', 'error');
      return;
    }
    const saved: GiraEvent = {
      id: Date.now().toString(),
      nome: newGira.nome,
      tipo: newGira.tipo,
      data: newGira.data,
      horario: newGira.horario || '20:00',
      status: newGira.status
    };
    setGiras([...giras, saved].sort((a,b) => a.data.localeCompare(b.data)));
    setNewGira({
      nome: '',
      tipo: 'Normal',
      data: '',
      horario: '20:00',
      status: 'Confirmada'
    });
    showNotification(`Gira "${saved.nome}" adicionada ao calendário!`);

    // Notificação do WhatsApp de Gira de forma automatizada para os Filhos de Santo (corrente)
    if (whatsappConnected && whatsappPreferences.notifGiras) {
      const formattedDate = saved.data.split('-').reverse().join('/');
      const textMsg = `📅 CONVOCAÇÃO DA CORRENTE: Salve a Corrente de Luz! O Zelador acabou de agendar uma nova Gira de *${saved.nome}*. 
      📅 Data: ${formattedDate} às ${saved.horario}. 
      👔 Vestimenta: Uniforme Branco Completo. Por favor, confirmem as presenças nos respectivos cambonos de escala! Axé.`;
      triggerWhatsappLog('Corrente Geral (34 médiuns)', textMsg, 'gira');
    }
  };

  const handleDeleteGira = (id: string, name: string) => {
    setGiras(giras.filter(g => g.id !== id));
    showNotification(`Sessão "${name}" removida.`, 'info');
  };

  // 4. Pontos Cantados Player Simulated Engine
  const pontosList: PontoCantado[] = [
    {
      id: '1',
      titulo: 'Hino da Umbanda',
      entidade: 'Todos os Orixás',
      linha: 'Hino',
      letra: [
        'Refletiu a Luz Divina',
        'Com todo o seu esplendor',
        'Vem do reino de Oxalá',
        'Onde há paz e amor.',
        'Luz que refletiu na terra',
        'Luz que refletiu no mar',
        'Luz que vem lá de Aruanda',
        'Para nos iluminar.',
        'Umbanda é paz e amor',
        'Um mundo cheio de luz',
        'É a força que nos protege',
        'É a força que nos conduz.'
      ]
    },
    {
      id: '2',
      titulo: 'Caboclo ventania chegou',
      entidade: 'Caboclo Ventania',
      linha: 'Oxóssi / Iansã',
      letra: [
        'Como venta na mata, como venta no mar',
        'É o Caboclo Ventania que vem nos saudar!',
        'Ele traz do outeiro o seu arco e flecha',
        'Pra vencer demanda sob a luz do luar.',
        'Oke Caboclo, a sua mata é bela!',
        'No rufar do tambor, a coroa dele brilha',
        'Trazendo a força do vento de Oyá.'
      ]
    },
    {
      id: '3',
      titulo: 'Ponto de Ogum Beira-Mar',
      entidade: 'Ogum Beira-Mar',
      linha: 'Ogum',
      letra: [
        'Ogum Beira-Mar o que trouxe do mar?',
        'Trouxe paz e saúde pra nos abençoar.',
        'Ele vem na onda, ele vence a maré',
        'Cavaleiro da lua, comandante de fé.',
        'Ogonhê, meu Santo, salve o seu escudo',
        'Salve a sua espada, salve o seu altar!'
      ]
    },
    {
      id: '4',
      titulo: 'Lá na Beira do Caminho (Preto Velho)',
      entidade: 'Preto Velho Pai Joaquim',
      linha: 'Pretos Velhos / Almas',
      letra: [
        'Lá na beira do caminho, sentado no toco',
        'Pai Joaquim pitando o seu cachimbo...',
        'Olha o terço das almas que corre na mão,',
        'Trazendo o consolo, trazendo o perdão.',
        'Adorei as Almas! As Almas adorei!',
        'Quem tem fé em Preto Velho nunca fica no chão.'
      ]
    }
  ];

  const [currentPontoIdx, setCurrentPontoIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lyricsProgressLine, setLyricsProgressLine] = useState(0);
  const [musicWaveHeight, setMusicWaveHeight] = useState<number[]>(new Array(16).fill(15));
  const waveTimer = useRef<NodeJS.Timeout | null>(null);

  // Soundwave and lyrics simulation
  useEffect(() => {
    if (isPlaying) {
      waveTimer.current = setInterval(() => {
        // Random bars for music visualizer
        setMusicWaveHeight(Array.from({ length: 16 }, () => Math.floor(Math.random() * 45) + 5));
        
        // Auto scroll lyrics line by line slowly
        setLyricsProgressLine(prev => {
          const currentPonto = pontosList[currentPontoIdx];
          if (prev >= currentPonto.letra.length - 1) {
            return 0; // wrap around
          }
          return prev + 1;
        });
      }, 3000);
    } else {
      if (waveTimer.current) clearInterval(waveTimer.current);
      setMusicWaveHeight(new Array(16).fill(4));
    }
    return () => {
      if (waveTimer.current) clearInterval(waveTimer.current);
    };
  }, [isPlaying, currentPontoIdx]);

  const selectPonto = (idx: number) => {
    setCurrentPontoIdx(idx);
    setLyricsProgressLine(0);
    setIsPlaying(true);
    showNotification(`Tocando simulação: "${pontosList[idx].titulo}"`);
  };

  const nextPonto = () => {
    const nextIdx = (currentPontoIdx + 1) % pontosList.length;
    selectPonto(nextIdx);
  };

  // 5. Pricing Dynamic Calculator Slider
  const [mediumsSliderValue, setMediumsSliderValue] = useState(30);
  
  // Calculate pricing tier details based on the slider value
  const getCalculatePlan = (numMediums: number) => {
    if (numMediums <= 15) {
      return {
        name: 'Terreiro Pequeno (Bronze)',
        price: 'R$ 49',
        priceLabel: 'por mês',
        desc: 'Ideal para terreiros em formação ou casas pequenas com menor corpo de médiuns.',
        recursos: [
          'Cadastro de até 15 Médiuns ativos',
          'Agenda de Giras e Calendário Interno',
          'Lançamentos Financeiros Básicos',
          'Acervo pessoal de Pontos Cantados',
          'Suporte via WhatsApp Comercial'
        ]
      };
    } else if (numMediums <= 50) {
      return {
        name: 'Terreiro em Expansão (Prata)',
        price: 'R$ 89',
        priceLabel: 'por mês',
        desc: 'A escolha mais popular. Atende com perfeição à grande maioria das casas de Axé do país.',
        recursos: [
          'Cadastro de até 50 Médiuns ativos',
          'Controle de Frequência / Presença eletrônica',
          'Financeiro robusto (Mensalidades, doações e caixa acumulativa)',
          'Envio automático de avisos corporativos por WhatsApp',
          'Cadastro detalhado de Orixás (Cabeça, Frente e Juntó)',
          'Upload de fotos e Guias Espirituais',
          'Suporte Prioritário por telefone e WhatsApp'
        ]
      };
    } else {
      return {
        name: 'Grande Fraternidade (Ouro)',
        price: 'R$ 149',
        priceLabel: 'por mês',
        desc: 'Para grandes templos, federações e terreiros tradicionais com alto volume e obrigações.',
        recursos: [
          'Médiuns cadastrados ILIMITADOS',
          'Módulos de frequência integrados com QR Code',
          'Fluxo de Caixa Avançado, balancetes e relatórios exportáveis PDF/Excel',
          'Site personalizado gratuito do terreiro (Ex: seu-terreiro.axecloud.com.br)',
          'Painel exclusivo para os Ogãs gerenciarem listas de louvação',
          'Controle de estoque de materiais de ritual (velas, guias, ervas, adês)',
          'Gerenciador de tarefas e escala de limpeza/preparo do congá',
          'Backup redundante criptografado em tempo real',
          'Acesso do Zelador + 3 administradores adicionais simultâneos'
        ]
      };
    }
  };

  const calculatedPlan = getCalculatePlan(mediumsSliderValue);

  // FAQ Accordion states
  const [faqExpanded, setFaqExpanded] = useState<Record<string, boolean>>({
    '1': true, // set first open
    '2': false,
    '3': false,
    '4': false,
    '5': false,
  });

  const toggleFaq = (id: string) => {
    setFaqExpanded(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const faqs = [
    {
      id: '1',
      question: 'O que é o Axé Cloud e por que ele foi criado?',
      answer: 'O Axé Cloud é um software de gestão (SaaS) brasileiro projetado de forma extremamente cuidadosa para terreiros, centros e barracões de Umbanda e Candomblé. Ele nasceu da necessidade de modernizar a gestão administrativa e o cadastro de fiéis das casas religiosas, garantindo eficiência, preservação histórica dos desenvolvimentos dos médiuns, transparência financeira e, acima de tudo, um ambiente digital seguro contra preconceito e intolerância.'
    },
    {
      id: '2',
      question: 'Como é garantida a segurança e privacidade dos dados?',
      answer: 'Sabemos que as religiões de matriz africana sofrem de intolerância social histórica. Por isso, a privacidade é nossa prioridade absoluta. O Axé Cloud utiliza criptografia ponta a ponta de nível militar para todos os membros. Seus dados cadastrais não são compartilhados, não constam em motores de busca públicos e você pode exportar ou excluir todos os seus registros quando desejar. A nossa nuvem hospeda as informações silenciosamente com absoluto sigilo institucional.'
    },
    {
      id: '3',
      question: 'O sistema entende a linguagem tradicional dos Terreiros?',
      answer: 'Totalmente! Nós abolimos jargões corporativos genéricos. Nosso painel é construído utilizando os termos reais da nossa tradição. Você encontrará campos estruturados para: Orixá de Frente, Orixá Juntó, Orixá Ancestral, Cargos Litúrgicos (Babalaô, Ialorixá, Ogã, Cambone, Babalorixá, Ekedi, Médium de Corrente), Destaques de Desenvolvimento, Linhas de Trabalho na Gira, Velas de Firmeza e Obrigações de Anos de Feitura (1, 3, 7 anos).'
    },
    {
      id: '4',
      question: 'Posso testar de graça antes de contratar para o meu centro?',
      answer: 'Sim! Oferecemos 14 dias de teste totalmente gratuito, sem necessidade de cartão de crédito. Além disso, criamos esta página com uma simulação interativa completa logo acima para que você possa vivenciar a beleza e simplicidade das telas antes mesmo de iniciar o cadastro da sua casa.'
    },
    {
      id: '5',
      question: 'Como funciona o envio de notificações por WhatsApp?',
      answer: 'Através de uma integração exclusiva simplificada, com apenas um clique você pode enviar de forma automatizada via WhatsApp avisos de próximas Giras, escalas de limpeza da casa, cobranças gentis de mensalidades atrasadas, ou os parabéns ao médium aniversariante do dia, estreitando as pontes de comunidade do seu povo de santo.'
    }
  ];

  return (
    <div className="bg-[#080A0D] text-[#F1F5F9] min-h-screen relative font-sans antialiased selection:bg-[#1E293B] selection:text-[#FFFFFF]">
      
      {/* Dynamic Pop notification toast */}
      {notification && (
        <div className="fixed top-6 right-6 md:right-12 z-50 animate-bounce bg-[#12161A] text-[#F1F5F9] px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 border border-[#FACC15]/30 max-w-sm">
          <div className="w-2 h-2 rounded-full bg-[#FACC15] animate-pulse"></div>
          <p className="text-sm font-medium">{notification.message}</p>
        </div>
      )}
 
      {/* Modern Background Subtle Accents */}
      <div className="absolute top-0 left-0 right-0 h-[650px] bg-gradient-to-b from-[#0D0F12] to-[#080A0D] pointer-events-none -z-10" />
      
      {/* Pure elegance: Decorative subtle pattern */}
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#FACC15]/8 rounded-full filter blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-[#10B981]/5 rounded-full filter blur-3xl pointer-events-none -z-10" />
 
      {/* TOP NAVIGATION HEADER */}
      <nav className="sticky top-0 z-40 bg-[#0B0D11]/90 backdrop-blur-md border-b border-[#1E242B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo area */}
            <div 
              className="flex items-center gap-3 cursor-pointer select-none" 
              onClick={() => { setCurrentPage('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              <div id="app-logo" className="w-11 h-11 rounded-xl bg-[#12161A] flex items-center justify-center shadow-lg shadow-black/45 border border-[#FACC15]/20">
                <Flame className="w-6 h-6 text-[#FACC15] fill-[#FACC15]/10" />
              </div>
              <div>
                <span className="font-display font-extrabold text-xl tracking-tight text-[#F1F5F9] flex items-center gap-1.5 leading-none">
                  Axé<span className="text-[#FACC15]">Cloud</span>
                </span>
                <span className="text-[9px] uppercase tracking-widest font-bold text-[#FACC15] block mt-0.5">Software de Terreiro</span>
              </div>
            </div>
 
            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-6">
              <button onClick={() => handleNavClick('plataforma')} className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition-colors bg-transparent border-none cursor-pointer">A Plataforma</button>
              <button onClick={() => handleNavClick('recursos')} className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition-colors bg-transparent border-none cursor-pointer">Recursos</button>
              <button 
                onClick={() => handleNavClick('portal-do-fiel', 'fiel')} 
                className={`text-sm font-medium transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer ${
                  currentPage === 'fiel' 
                    ? 'text-white bg-rose-600 border-rose-500 shadow-md shadow-rose-950/40' 
                    : 'text-rose-400 hover:text-rose-300 bg-rose-500/10 border-rose-500/20 shadow-sm shadow-rose-950/20 animate-pulse'
                }`}
              >
                <Heart className="w-3.5 h-3.5 fill-current text-rose-500 animate-pulse" />
                Espaço do Fiel (Pedir Reza)
              </button>
              <button onClick={() => handleNavClick('demonstracao')} className="text-sm font-medium text-[#F1F5F9] font-semibold flex items-center gap-1 bg-[#1E242B]/80 px-3 py-1.5 rounded-lg border border-[#2F3643] transition-all bg-transparent cursor-pointer">
                <Sparkles className="w-3.5 h-3.5 text-[#FACC15]" />
                Demo Interativa
              </button>
              <button onClick={() => handleNavClick('calculadora')} className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition-colors bg-transparent border-none cursor-pointer">Planos & Preços</button>
              <button onClick={() => handleNavClick('seguranca')} className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition-colors bg-transparent border-none cursor-pointer">Segurança</button>
            </div>
 
            {/* CTA action buttons */}
            <div className="hidden md:flex items-center gap-4">
              <button 
                id="btn-login-header"
                onClick={() => showNotification("Funcionalidade de login disponível no painel real em produção.", "info")} 
                className="text-sm font-semibold text-[#94A3B8] hover:text-[#FACC15] px-3 py-2 transition-colors bg-transparent border-none cursor-pointer"
              >
                Entrar
              </button>
              <button 
                id="btn-signup-header"
                onClick={() => handleNavClick('calculadora')} 
                className="bg-[#FACC15] hover:bg-[#FDE047] text-[#080A0D] text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-md shadow-black/20 border border-[#FACC15]/20 text-center cursor-pointer"
              >
                Criar Conta Grátis
              </button>
            </div>
 
            {/* Mobile menu button toggle */}
            <div className="md:hidden flex items-center">
              <button 
                id="btn-mobile-toggle"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-[#F1F5F9] hover:text-[#FACC15] p-2 rounded-lg transition-colors focus:outline-none"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
 
        {/* Mobile menu panel dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0B0D11] border-b border-[#1E242B] animate-fadeIn transition-all">
            <div className="px-4 pt-2 pb-6 space-y-3 shadow-inner">
              <button onClick={() => handleNavClick('plataforma')} className="block w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-[#94A3B8] hover:bg-[#12161A] hover:text-[#F1F5F9] bg-transparent border-none">A Plataforma</button>
              <button onClick={() => handleNavClick('recursos')} className="block w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-[#94A3B8] hover:bg-[#12161A] hover:text-[#F1F5F9] bg-transparent border-none">Recursos</button>
              <button onClick={() => handleNavClick('demonstracao')} className="block w-full text-left px-3 py-2.5 rounded-lg text-base font-semibold text-[#FACC15] bg-[#1E242B]/80 border-none">Demo Interativa</button>
              <button 
                onClick={() => handleNavClick('portal-do-fiel', 'fiel')} 
                className={`block w-full text-left px-3 py-2.5 rounded-lg text-base font-semibold flex items-center gap-2 border-none cursor-pointer ${
                  currentPage === 'fiel' ? 'text-white bg-rose-600' : 'text-rose-400 bg-rose-950/20'
                }`}
              >
                <Heart className="w-4 h-4 fill-current animate-pulse text-rose-500" />
                Espaço do Fiel (Pedir Reza)
              </button>
              <button onClick={() => handleNavClick('calculadora')} className="block w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-[#94A3B8] hover:bg-[#12161A] hover:text-[#F1F5F9] bg-transparent border-none">Planos & Preços</button>
              <button onClick={() => handleNavClick('seguranca')} className="block w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-[#94A3B8] hover:bg-[#12161A] hover:text-[#F1F5F9] bg-transparent border-none">Segurança</button>
              <div className="pt-4 flex flex-col gap-2">
                <button 
                  id="btn-login-mobile"
                  onClick={() => { setMobileMenuOpen(false); showNotification("Simulação - utilize o criador de conta abaixo ou teste a demo interativa.", "info"); }} 
                  className="w-full text-center py-2.5 text-sm font-semibold text-[#F1F5F9] border border-[#1E242B] rounded-xl bg-white/5"
                >
                  Entrar no Painel
                </button>
                <button 
                  id="btn-signup-mobile"
                  onClick={() => handleNavClick('calculadora')} 
                  className="w-full text-center py-2.5 text-sm font-bold bg-[#FACC15] text-[#080A0D] rounded-xl hover:bg-[#FDE047] border-none cursor-pointer"
                >
                  Cadastrar Grátis
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {currentPage === 'landing' ? (
        <>
          {/* HERO SECTION */}
          <header className="pt-12 pb-20 md:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        {/* Subtle ribbon label */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#13171D] border border-[#FACC15]/30 mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-[#FACC15]" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#F1F5F9]">
            Pioneira no Brasil • 100% Criptografado & Respeitoso
          </span>
        </div>

        {/* Big Bold Headline */}
        <h1 className="font-display font-black text-4xl sm:text-5xl md:text-6.5xl text-[#F1F5F9] tracking-tight max-w-4xl mx-auto leading-tight md:leading-[1.1]">
          A gestão do seu <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FACC15] via-[#F59E0B] to-[#FCD34D] inline-block">Terreiro</span> em perfeita harmonia.
        </h1>

        {/* Elegant spacing and premium description text */}
        <p className="mt-8 text-base md:text-xl text-[#94A3B8] max-w-3xl mx-auto font-light leading-relaxed">
          O <strong>Axé Cloud</strong> é a primeira plataforma em nuvem criada especificamente para organizar a rotina, o corpo mediúnico, a curimba e o financeiro de casas de <strong>Umbanda e Candomblé</strong>. Proteja os dados históricos do seu povo do santo com respeito e sigilo absoluto.
        </p>

        {/* Actions button block */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <a 
            id="hero-primary-cta"
            href="#demonstracao" 
            className="w-full sm:w-auto bg-[#FACC15] hover:bg-[#FDE047] text-[#080A0D] font-bold text-sm px-8 py-4.5 rounded-2xl transition-all shadow-xl hover:shadow-2xl hover:shadow-[#FACC15]/15 border border-[#FACC15]/10 duration-200 flex items-center justify-center gap-2"
          >
            Experimentar Demo Ao Vivo
            <ArrowRight className="w-4 h-4 text-[#080A0D]" />
          </a>
          <a 
            id="hero-secondary-cta"
            href="#calculadora" 
            className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-[#F1F5F9] font-semibold text-sm px-6 py-4 rounded-2xl border border-white/15 transition-all duration-200 flex items-center justify-center gap-2"
          >
            Ver Planos Ativos
          </a>
        </div>

        {/* Visual trust badge */}
        <div className="mt-12 flex items-center justify-center gap-8 flex-wrap opacity-85">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Segurança Criptografada</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8]">
            <Heart className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>Foco Comunidade</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8]">
            <Flame className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>Adequado às Sete Linhas e Nações</span>
          </div>
        </div>
      </header>

      {/* CORE PHILOSOPHY / TRADITION SECTION */}
      <section id="plataforma" className="py-16 md:py-24 bg-[#0B0D11] border-y border-[#1E242B] relative overflow-hidden">
        {/* Background circular highlight */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#0E1116] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display font-extrabold text-3xl md:text-4xl text-[#F1F5F9] tracking-tight">
              Uma ferramenta ungida com <span className="text-[#FACC15]">Respeito e Tradição</span>
            </h2>
            <p className="mt-4 text-[#94A3B8] text-base md:text-lg">
              Diferente de sistemas de e-commerce ou gerências de escritório frias, as funcionalidades do Axé Cloud foram esculpidas ouvindo zeladores, mães e pais de santo, ogãs e médiuns da corrente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            
            {/* Card 1: Proteção e Intolerância zero */}
            <div id="card-phi-1" className="bg-[#13171D] p-8 rounded-2xl border border-[#1E242B] hover:border-[#FACC15]/40 transition-all hover:translate-y-[-4px] group">
              <div className="w-12 h-12 bg-[#1E252E] rounded-xl shadow-sm border border-[#2F3643] flex items-center justify-center text-[#FACC15] mb-6 group-hover:bg-[#FACC15] group-hover:text-[#080A0D] transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#F1F5F9] mb-3">Privacidade Silenciosa</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                Ambiente fechado da sua casa religiosa. Apenas pessoas autorizadas têm acesso. Ficha de desenvolvimento espiritual, batismo e feitura do médium protegidos sob sigilo canônico absoluto.
              </p>
            </div>

            {/* Card 2: Liturgia Nativa */}
            <div id="card-phi-2" className="bg-[#13171D] p-8 rounded-2xl border border-[#1E242B] hover:border-[#FACC15]/40 transition-all hover:translate-y-[-4px] group">
              <div className="w-12 h-12 bg-[#1E252E] rounded-xl shadow-sm border border-[#2F3643] flex items-center justify-center text-[#2E5A44] mb-6 group-hover:bg-[#2E5A44] group-hover:text-white transition-colors">
                <Leaf className="w-5 h-5 text-emerald-400 group-hover:text-white" />
              </div>
              <h3 className="text-lg font-bold text-[#F1F5F9] mb-3">Respeito Litúrgico</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                Nossos campos utilizam termos litúrgicos reais: Amaci do Médium, Orixá de Cabeça, Guia de Frente (Caboclos, Exus, Pretos Velhos), Adoxado, Abian, Ogãs, Cambones, Coroa de Santo e Obrigações de Anos.
              </p>
            </div>

            {/* Card 3: Unidade de Comunidade */}
            <div id="card-phi-3" className="bg-[#13171D] p-8 rounded-2xl border border-[#1E242B] hover:border-[#FACC15]/40 transition-all hover:translate-y-[-4px] group">
              <div className="w-12 h-12 bg-[#1E252E] rounded-xl shadow-sm border border-[#2F3643] flex items-center justify-center text-[#C5A059] mb-6 group-hover:bg-[#C5A059] group-hover:text-[#080A0D] transition-colors">
                <Users className="w-5 h-5 text-amber-400 group-hover:text-[#080A0D]" />
              </div>
              <h3 className="text-lg font-bold text-[#F1F5F9] mb-3">Conexão Consistente</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                Aproxima o terreiro de seus praticantes frequentes através de avisos, escala de trabalhos espirituais nos dias de gira, comemorações de aniversariantes e de formações da corrente.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* RECURSOS / FEATURES BENTO GRID */}
      <section id="recursos" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold text-[#FACC15] uppercase tracking-widest block mb-2">Poder Tecnológico</span>
          <h2 className="font-display font-black text-3xl md:text-5xl tracking-tight text-[#F1F5F9]">
            Tudo o que seu Terreiro precisa para evoluir organizado
          </h2>
          <p className="mt-4 text-[#94A3B8] text-base md:text-lg font-light">
            Deixe as velhas planilhas de lado ou cadernos rasgados que podem molhar ou sumir. Desfrute de um sistema integrado e sempre seguro.
          </p>
        </div>

        {/* Bento Grid Concept */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Bento Item 1: Corpo Mediúnico */}
          <div id="feat-bento-1" className="md:col-span-7 bg-[#13171D] p-8 rounded-3xl border border-[#1E242B] shadow-lg flex flex-col justify-between relative overflow-hidden group hover:shadow-xl hover:border-[#FACC15]/30 transition-all">
            <div className="absolute top-4 right-4 text-[#FACC15]/5 opacity-60">
              <Users className="w-40 h-40 transform translate-x-12 translate-y-6" />
            </div>
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#1E252E] border border-[#2F3643] flex items-center justify-center text-[#FACC15] mb-6">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-[#F1F5F9] mb-2 leading-tight">Painel Completo de Médiuns (Ficha de Santo)</h3>
              <p className="text-sm text-[#94A3B8] max-w-md">
                Cadastre data de entrada na corrente, Orixás regentes, guias mentores, fardas de trabalho, presença nas giras passadas, e datas de obrigações de santo. Sem limite de anotações confidenciais.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-[#1E242B] flex items-center justify-between text-xs text-[#FACC15] font-bold">
              <span>Campos litúrgicos específicos</span>
              <span className="bg-[#1E252E] px-3 py-1 rounded-full border border-[#2F3643] text-[#F1F5F9]">100% Customizável</span>
            </div>
          </div>

          {/* Bento Item 2: Financeiro */}
          <div id="feat-bento-2" className="md:col-span-5 bg-[#13171D] p-8 rounded-3xl border border-[#1E242B] shadow-lg flex flex-col justify-between relative overflow-hidden group hover:shadow-xl hover:border-[#FACC15]/30 transition-all">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#1E252E] border border-[#2F3643] flex items-center justify-center text-[#2E5A44] mb-6">
                <Coins className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-[#F1F5F9] mb-2 leading-tight">Caixa Transparente & Mensalidades</h3>
              <p className="text-sm text-[#94A3B8]">
                Acompanhe o pagamento de mensalidades dos médiuns, doações voluntárias de consulentes e gastos com festas, velas de conga, fiação, defumadores e reparos. Relatórios limpos e prontificados para prestação de contas.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-[#1E242B] flex items-center justify-between text-xs text-emerald-400 font-bold">
              <span>Reporte e auditoria limpa</span>
              <span className="bg-[#1E252E] text-xs font-semibold text-[#F1F5F9] px-2.5 py-1 rounded-lg">Fim do "caderno do caixa"</span>
            </div>
          </div>

          {/* Bento Item 3: Giras e Agenda */}
          <div id="feat-bento-3" className="md:col-span-4 bg-[#13171D] p-8 rounded-3xl border border-[#1E242B] shadow-lg flex flex-col justify-between relative overflow-hidden group hover:shadow-xl hover:border-[#FACC15]/30 transition-all">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#1E252E] border border-[#2F3643] flex items-center justify-center text-[#9F5234] mb-6">
                <Calendar className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-xl font-bold text-[#F1F5F9] mb-2 leading-tight">Calendário de Giras e Festividades</h3>
              <p className="text-sm text-[#94A3B8]">
                Agende giras de Caboclo, Pretos Velhos, Boiadeiros, Exu e festas públicas como Cosme e Damião ou Iemanjá. Envie programações de forma antecipada para que ninguém se atrase ou perca o dia de obrigação.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-[#1E242B] text-xs text-[#FACC15] font-bold flex justify-between items-center">
              <span>Sincronização Online</span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            </div>
          </div>

          {/* Bento Item 4: Curimba e Pontos */}
          <div id="feat-bento-4" className="md:col-span-8 bg-[#13171D] p-8 rounded-3xl border border-[#1E242B] shadow-lg flex flex-col justify-between relative overflow-hidden group hover:shadow-xl hover:border-[#FACC15]/30 transition-all">
            <div className="absolute top-4 right-4 text-[#FACC15]/5 opacity-40">
              <Music className="w-44 h-44 pointer-events-none" />
            </div>
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#1E252E] border border-[#2F3643] flex items-center justify-center text-[#C5A059] mb-6">
                <Music className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-[#F1F5F9] mb-2 leading-tight">Acervo Digital de Pontos Cantados</h3>
              <p className="text-sm text-[#94A3B8] max-w-lg">
                Cadastre a letra de pontos cantados e pontos riscados das entidades do terreiro para que os novos médiuns e a curimba possam estudar e cantar juntos em harmonia. Guarde a tradição cantada oral do seu terreiro em um cofre histórico.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-[#1E242B] flex items-center justify-between text-xs text-[#F1F5F9] font-bold">
              <span>Exclusivo para Ogãs, Curimbas e Corrente</span>
              <span className="bg-emerald-950/40 text-emerald-300 border border-emerald-800/20 px-3 py-1 rounded-full text-[10px]">Pioneirismo Cultural</span>
            </div>
          </div>

        </div>
      </section>

      {/* INTERACTIVE WORKSTATION DEMO TAB COMPONENT */}
      <section id="demonstracao" className="py-20 bg-[#080A0D] border-y border-[#1E242B] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold text-[#FACC15] bg-[#1E252E] px-3 py-1.5 rounded-full uppercase tracking-wider inline-block mb-3 border border-[#FACC15]/20">
              Simulador Interativo
            </span>
            <h2 className="font-display font-black text-3.5xl md:text-5xl tracking-tight text-[#F1F5F9]">
              Painel de Gestão: Experimente Agora!
            </h2>
            <p className="mt-4 text-[#94A3B8] text-sm md:text-base font-light mx-auto max-w-2xl">
              Criamos este simulador <strong>100% funcional</strong> para você vivenciar algumas das nossas ferramentas. Insira novos médiuns, registre mensalidades imaginárias, marque giras ou toque uma simulação de pontos cantados!
            </p>
          </div>

          <div id="demo-dashboard" className="bg-[#0B0D11] rounded-3xl border border-[#1E242B] shadow-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300">
            {/* Top Bar of the Mock Dashboard with Interactive User Switcher and Login Security */}
            {!isDemoLoggedIn ? (
              <div className="bg-[#13171D] p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#1E242B]">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FACC15] to-[#F59E0B] flex items-center justify-center shrink-0">
                    <Flame className="w-5 h-5 text-[#13171D] fill-[#13171D]/15 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold tracking-wide text-[#F1F5F9] flex items-center gap-1.5 leading-none">
                      Templo Caboclo Ventania
                      <span className="text-[9px] bg-rose-950/80 text-rose-450 px-2 py-0.5 rounded font-black border border-rose-500/20 uppercase tracking-widest">Acesso Restrito</span>
                    </h4>
                    <p className="text-[10.5px] text-gray-400 mt-1 font-medium">
                      Simulação do Painel Administrativo do Terreiro
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-rose-400 text-xs font-extrabold bg-[#12161A] border border-rose-500/10 px-4 py-2 rounded-xl">
                  <Lock className="w-3.5 h-3.5 animate-bounce" />
                  Autenticação Requerida
                </div>
              </div>
            ) : (
              <div className="bg-[#13171D] p-5 text-white flex flex-col xl:flex-row items-center justify-between gap-4 border-b border-[#FACC15]/10">
                <div className="flex items-center justify-between xl:justify-start gap-3 w-full xl:w-auto">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FACC15] to-[#F59E0B] flex items-center justify-center shrink-0">
                      <Flame className="w-5 h-5 text-[#13171D] fill-[#13171D]/15" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold tracking-wide text-[#F1F5F9] flex items-center gap-1.5 leading-none">
                        Templo Caboclo Ventania <span className="text-[10px] bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded font-bold border border-teal-500/20">Demo Ativa</span>
                      </h4>
                      <p className="text-[10px] text-[#FACC15] mt-1 font-medium">
                        Sessão: {userRole === 'zelador' ? '👑 Painel da Zeladoria (Pai Alexandre)' : '🕯️ Portal do Filho (Lucas Augusto)'}
                      </p>
                    </div>
                  </div>

                  {/* LOGOUT BUTTON FOR ALL ROLES */}
                  <button
                    onClick={() => {
                      setIsDemoLoggedIn(false);
                      showNotification('Sessão desconectada com sucesso. Volte a testar quando quiser!', 'info');
                    }}
                    className="px-3 py-1.5 bg-rose-950/30 hover:bg-rose-900 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ml-4 xl:hidden"
                    title="Desconectar Sessão"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sair
                  </button>
                </div>

                {/* INTERACTIVE USER ROLE SWITCHER */}
                <div className="flex bg-[#12161A] p-1 rounded-xl border border-[#1E242B] gap-1 shrink-0 w-full xl:w-auto justify-center">
                  <button
                    onClick={() => {
                      setUserRole('zelador');
                      setActiveDashboardTab('inicio');
                      showNotification('Painel da Zeladoria Ativado!', 'success');
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center ${
                      userRole === 'zelador'
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-[#080A0D] font-black shadow-lg shadow-yellow-500/10'
                        : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Zelador (Admin)
                  </button>
                  <button
                    onClick={() => {
                      setUserRole('filho');
                      setSelectedMedium(null); // Clear active selected medium to show portal
                      showNotification('Portal do Filho de Santo ativo!', 'info');
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center ${
                      userRole === 'filho'
                        ? 'bg-[#FACC15] text-[#080A0D] font-black'
                        : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Filho de Santo (Leitura)
                  </button>
                </div>

                {/* Navigation Tabs (ONLY SHOWN IF USER IS ZELADOR) */}
                {userRole === 'zelador' ? (
                  <div className="flex flex-wrap items-center justify-center gap-1 bg-[#12161A] p-1 rounded-xl border border-[#1E242B] w-full xl:w-auto">
                    <button
                      id="tab-inicio"
                      onClick={() => {
                        setActiveDashboardTab('inicio');
                        showNotification('Painel Inicial de Controle do Terreiro!');
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeDashboardTab === 'inicio' ? 'bg-[#FACC15] text-[#080A0D] shadow-sm font-black' : 'text-[#94A3B8] hover:text-white hover:bg-white/5'}`}
                    >
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      Início
                    </button>
                    <button
                      id="tab-médiums"
                      onClick={() => setActiveDashboardTab('mediums')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeDashboardTab === 'mediums' ? 'bg-[#FACC15] text-[#080A0D] shadow-sm font-black' : 'text-[#94A3B8] hover:text-white hover:bg-white/5'}`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      Corrente
                    </button>
                    <button
                      id="tab-financeiro"
                      onClick={() => setActiveDashboardTab('financeiro')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeDashboardTab === 'financeiro' ? 'bg-[#FACC15] text-[#080A0D] shadow-sm font-black' : 'text-[#94A3B8] hover:text-white hover:bg-white/5'}`}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      Financeiro
                    </button>
                    <button
                      id="tab-giras"
                      onClick={() => setActiveDashboardTab('giras')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeDashboardTab === 'giras' ? 'bg-[#FACC15] text-[#080A0D] shadow-sm font-black' : 'text-[#94A3B8] hover:text-white hover:bg-white/5'}`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Giras
                    </button>
                    <button
                      id="tab-pontos"
                      onClick={() => setActiveDashboardTab('pontos')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeDashboardTab === 'pontos' ? 'bg-[#FACC15] text-[#080A0D] shadow-sm font-black' : 'text-[#94A3B8] hover:text-white hover:bg-white/5'}`}
                    >
                      <Music className="w-3.5 h-3.5" />
                      Curimba
                    </button>
                    <button
                      id="tab-reza"
                      onClick={() => setActiveDashboardTab('reza')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeDashboardTab === 'reza' ? 'bg-[#FACC15] text-[#080A0D] shadow-sm font-black' : 'text-[#94A3B8] hover:text-[#FACC15] hover:bg-white/5'}`}
                    >
                      <Heart className="w-3.5 h-3.5 text-rose-500 animate-pulse fill-rose-500/20" />
                      Pedidos
                    </button>
                    <button
                      id="tab-whatsapp"
                      onClick={() => {
                        setActiveDashboardTab('whatsapp');
                        showNotification('Fila de Disparo Remoto do WhatsApp carregada!');
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeDashboardTab === 'whatsapp' ? 'bg-[#10B981] text-[#080A0D] shadow-sm font-black' : 'text-[#94A3B8] hover:text-[#10B981] hover:bg-white/5'}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp
                    </button>
                    <button
                      id="tab-galeria"
                      onClick={() => {
                        setActiveDashboardTab('galeria');
                        showNotification('Galeria de Lembranças e Álbum de Fotos carregado!');
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeDashboardTab === 'galeria' ? 'bg-[#D97706] text-white shadow-sm font-black' : 'text-[#94A3B8] hover:text-[#D97706] hover:bg-white/5'}`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      Galeria
                    </button>
                    <button
                      id="tab-configuracoes"
                      onClick={() => {
                        setActiveDashboardTab('configuracoes');
                        showNotification('Seção de Configurações da Casa carregada!');
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeDashboardTab === 'configuracoes' ? 'bg-[#3B82F6] text-white shadow-sm font-black' : 'text-[#94A3B8] hover:text-[#3B82F6] hover:bg-white/5'}`}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Configurações
                    </button>

                    {/* DESKTOP LOGOUT BUTTON */}
                    <button
                      onClick={() => {
                        setIsDemoLoggedIn(false);
                        showNotification('Sessão encerrada com sucesso.', 'info');
                      }}
                      className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900 border border-thin border-rose-500/20 text-rose-400 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ml-1"
                      title="Sair do Painel"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sair
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-4 w-full xl:w-auto">
                    <div className="flex flex-wrap items-center gap-2 bg-[#12161A] p-1 rounded-xl border border-[#1E242B]">
                      <button
                        onClick={() => {
                          setActiveDashboardTab('inicio');
                          showNotification('Seu Painel do Filho de Santo carregado!');
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeDashboardTab !== 'galeria' ? 'bg-[#FACC15] text-[#080A0D] font-black' : 'text-[#94A3B8] hover:text-white hover:bg-white/5'}`}
                      >
                        <User className="w-3.5 h-3.5" />
                        Meu Painel
                      </button>
                      <button
                        onClick={() => {
                          setActiveDashboardTab('galeria');
                          showNotification('Galeria de Memórias e Fotos do Terreiro!');
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeDashboardTab === 'galeria' ? 'bg-[#D97706] text-white font-black shadow-sm' : 'text-[#94A3B8] hover:text-[#D97706] hover:bg-white/5'}`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Galeria de Memórias 📷
                      </button>
                    </div>
                    {/* DESKTOP LOGOUT BUTTON (Filho) */}
                    <button
                      onClick={() => {
                        setIsDemoLoggedIn(false);
                        showNotification('Sessão encerrada com sucesso.', 'info');
                      }}
                      className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900 border border-thin border-rose-500/20 text-rose-400 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                      title="Sair do Painel"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Dashboard Workspace */}
            <div className="p-6 md:p-8 bg-[#0D0F12]">
              {!isDemoLoggedIn ? (
                /* PAGINA DE LOGIN INTERATIVA E IMERSIVA DO TERREIRO */
                <div className="max-w-md mx-auto my-6 bg-[#13171D] rounded-3xl border border-[#1E242B] p-8 shadow-2xl relative overflow-hidden animate-fadeIn text-[#F1F5F9]">
                  {/* Glowing ambient background circle */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#FACC15]/5 rounded-full blur-3xl pointer-events-none" />

                  <div className="text-center relative z-10 space-y-3 mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FACC15] to-[#F59E0B] mx-auto flex items-center justify-center shadow-lg border border-[#FACC15]/20 shadow-amber-500/10 mb-4 animate-pulse">
                      <Flame className="w-8 h-8 text-black fill-yellow-950/10" />
                    </div>
                    <div>
                      <h4 className="font-display font-black text-2xl text-white tracking-tight uppercase">Templo Ventania</h4>
                      <p className="text-xs text-[#FACC15] font-bold uppercase tracking-widest mt-1">Gestão de Terreiro & Corrente</p>
                    </div>
                    <p className="text-xs text-gray-400 font-light leading-relaxed px-2">
                      Portão de entrada seguro para a comunidade de sacerdotes e médiuns. Acesse seu painel individual.
                    </p>
                  </div>

                  {/* FORM FIELDS */}
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!loginEmail.trim()) {
                      showNotification('Por favor, informe seu e-mail de acesso.', 'error');
                      return;
                    }
                    setIsDemoLoggedIn(true);
                    showNotification(`Bem-vindo de volta! Acesso concedido como ${userRole === 'zelador' ? 'Zelador de Santo' : 'Filho de Santo'}.`, 'success');
                  }} className="space-y-5 relative z-10">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-gray-400 tracking-wider mb-2">Perfil Litúrgico</label>
                      <div className="grid grid-cols-2 gap-2 bg-[#0C0E12] p-1 rounded-xl border border-[#1E242B]">
                        <button
                          type="button"
                          onClick={() => {
                            setUserRole('zelador');
                            setLoginEmail('pai.alexandre@cabocloventania.org');
                            showNotification('Tipo de Login: Zelador Litúrgico selecionado.', 'info');
                          }}
                          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            userRole === 'zelador'
                              ? 'bg-[#FACC15] text-[#080A0D] font-black shadow-md'
                              : 'text-gray-400 hover:text-white'
                          }`}
                          style={{ color: userRole === 'zelador' ? '#080A0D' : '#94A3B8' }}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Zelador
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUserRole('filho');
                            setLoginEmail('lucas.augusto@cabocloventania.org');
                            setSelectedMedium(null);
                            showNotification('Tipo de Login: Filho de Santo selecionado.', 'info');
                          }}
                          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            userRole === 'filho'
                              ? 'bg-[#FACC15] text-[#080A0D] font-black shadow-md'
                              : 'text-gray-400 hover:text-white'
                          }`}
                          style={{ color: userRole === 'filho' ? '#080A0D' : '#94A3B8' }}
                        >
                          <User className="w-3.5 h-3.5" />
                          Filho de Santo
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-gray-400 tracking-wider mb-2">E-mail Administrativo</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">
                          @
                        </span>
                        <input
                          type="email"
                          required
                          placeholder="seu.nome@cabocloventania.org"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="w-full text-xs bg-[#0D0F12] border border-[#1E242B] rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-[#FACC15] focus:ring-1 focus:ring-[#FACC15]/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-gray-400 tracking-wider mb-2">Senha de Acesso</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="w-full text-xs bg-[#0D0F12] border border-[#1E242B] rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-[#FACC15] focus:ring-1 focus:ring-[#FACC15]/20"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-extrabold py-3.5 rounded-xl hover:from-yellow-400 hover:to-amber-400 transition-all hover:scale-[1.01] active:scale-95 shadow-lg shadow-yellow-500/10 flex items-center justify-center gap-2 cursor-pointer mt-6 font-black"
                    >
                      <Lock className="w-4 h-4" />
                      Entrar no Painel Seguro
                    </button>
                  </form>

                  {/* CREDENCIAIS RAPIDAS DE DEMONSTRACAO */}
                  <div className="mt-8 pt-6 border-t border-[#1E242B] relative z-10">
                    <span className="block text-[9px] font-extrabold uppercase text-[#FACC15] tracking-widest text-center mb-3">Escolha um Perfil para Testar</span>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUserRole('zelador');
                          setLoginEmail('pai.alexandre@cabocloventania.org');
                          setLoginPassword('123456');
                          setIsDemoLoggedIn(true);
                          setActiveDashboardTab('inicio');
                          showNotification('Acesso Rápido: Pai Alexandre de Ogum (Zelador de Santo)!', 'success');
                        }}
                        className="w-full bg-[#0D0F12] hover:bg-[#12161A] hover:border-amber-500/30 p-2.5 rounded-xl border border-[#1E242B] text-left transition-all flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div>
                          <span className="block text-[10px] font-bold text-white leading-none">Pai Alexandre (Zelador Admin)</span>
                          <span className="text-[9px] text-gray-400 mt-1 block truncate">pai.alexandre@cabocloventania.org</span>
                        </div>
                        <span className="text-[9px] uppercase font-bold text-amber-500 bg-amber-500/5 border border-amber-500/10 rounded px-1.5 py-0.5 shrink-0">Zelador 👑</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUserRole('filho');
                          setLoginEmail('lucas.augusto@cabocloventania.org');
                          setLoginPassword('123456');
                          setSelectedMedium(null);
                          setIsDemoLoggedIn(true);
                          showNotification('Acesso Rápido: Lucas Augusto (Filho de Santo)!', 'success');
                        }}
                        className="w-full bg-[#0D0F12] hover:bg-[#12161A] hover:border-emerald-500/30 p-2.5 rounded-xl border border-[#1E242B] text-left transition-all flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div>
                          <span className="block text-[10px] font-bold text-white leading-none">Lucas Augusto (Filho de Santo)</span>
                          <span className="text-[9px] text-gray-400 mt-1 block truncate">lucas.augusto@cabocloventania.org</span>
                        </div>
                        <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded px-1.5 py-0.5 shrink-0">Filho 🕯️</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : userRole === 'filho' ? (
                /* FILHO DE SANTO MAIN PORTAL PORTLET (READ-ONLY) */
                <div className="space-y-8 animate-fadeIn text-[#F1F5F9]">
                  {/* HEADER SALUTATION CARD */}
                  <div className="relative overflow-hidden bg-[#13171D] p-6 rounded-3xl border border-[#1E242B] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#FACC15] to-[#F59E0B] flex items-center justify-center font-bold text-black border-2 border-[#1E242B] shadow-inner text-lg">
                        LA
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 bg-yellow-950/45 text-[#FACC15] border border-yellow-500/20 rounded-full">
                          Mapeamento Litúrgico Ativo
                        </span>
                        <h5 className="font-display font-black text-xl text-[#F1F5F9] mt-1">Lucas Augusto</h5>
                        <p className="text-xs text-gray-400">Cargo Litúrgico: <span className="font-semibold text-white">Ogã (Tocador)</span> • Matrícula: <span className="font-semibold text-[#FACC15]">AXC-2021-352B</span></p>
                      </div>
                    </div>

                    {/* LIGURTICAL METADATA */}
                    <div className="flex flex-wrap items-center gap-3 md:border-l md:border-[#1E242B] md:pl-6">
                      <div className="bg-[#12161A] p-2 rounded-xl border border-[#1E242B] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-black" title="Orixá de Frente" />
                        <div>
                          <span className="block text-[8px] font-bold text-gray-500 uppercase">Pai de Cabeça</span>
                          <span className="text-xs font-black text-[#FACC15]">Azansu (Obaluaiê)</span>
                        </div>
                      </div>
                      <div className="bg-[#12161A] p-2 rounded-xl border border-[#1E242B] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-pink-500 border border-black" title="Orixá Mãe de Frente" />
                        <div>
                          <span className="block text-[8px] font-bold text-gray-500 uppercase">Mãe de Cabeça</span>
                          <span className="text-xs font-black text-[#FACC15]">Nanã Buruquê</span>
                        </div>
                      </div>
                      <div className="bg-[#12161A] p-2 rounded-xl border border-[#1E242B] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] border border-black" title="Guia Litúrgica" />
                        <div>
                          <span className="block text-[8px] font-bold text-gray-500 uppercase">Guia Frente</span>
                          <span className="text-xs font-black text-[#10B981]">Pai Joaquim</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TWO COLUMN GRID LAYOUT */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* LEFT SIDE: FINANCEIRO, PIX & OBRIGAÇÕES (COL 7) */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      {/* FINANCE SECTION */}
                      <div className="bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] space-y-6">
                        <div className="flex items-center justify-between border-b border-[#1E242B] pb-4">
                          <div>
                            <h6 className="font-display font-bold text-base text-white flex items-center gap-2">
                              <Coins className="w-4.5 h-4.5 text-[#FACC15]" />
                              Portal de Tesouraria Simplificado
                            </h6>
                            <p className="text-xs text-[#94A3B8]">Consulte suas mensalidades e contribuições litúrgicas oficiais da corrente.</p>
                          </div>
                          <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-500/25 rounded">
                            Consultas em Dia
                          </span>
                        </div>

                        {/* MAY FEE AND INTERACTIVE PIX BLOCK */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Payment Pending Block */}
                          <div className="p-4 rounded-xl border border-rose-500/10 bg-rose-500/5 flex flex-col justify-between">
                            <div>
                              <span className="text-[8.5px] uppercase font-extrabold tracking-wider px-2 py-0.5 bg-rose-950/60 text-rose-300 border border-rose-800/40 rounded-full">
                                Próxima Mensalidade
                              </span>
                              <h5 className="font-black text-2xl text-white mt-3">R$ 100,00</h5>
                              <p className="text-[11px] text-[#94A3B8] font-medium mt-1">
                                Referência: <span className="text-[#F1F5F9] font-bold">Maio / 2026</span>
                              </p>
                              <p className="text-[11px] text-[#94A3B8] flex items-center gap-1 mt-1">
                                <Clock className="w-3.5 h-3.5 text-rose-400 font-bold" />
                                Vence em: <span className="text-rose-300 font-bold">10/05/2026</span>
                              </p>
                            </div>

                            {/* Simulated Payment Button */}
                            {(() => {
                              const lucasObj = mediums.find(m => m.id === '6') || mediums[0];
                              const isMayPaid = lucasObj.historicoFinanceiro?.find(h => h.mes.includes('Maio'))?.status === 'PG';

                              return isMayPaid ? (
                                <div className="mt-4 p-2 bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 rounded-lg text-center font-black text-xs flex items-center justify-center gap-1.5">
                                  <Check className="w-4 h-4 text-emerald-400" />
                                  Mensalidade Paga!
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    // Make simulation
                                    setMediums(prev => prev.map(m => {
                                      if (m.id === '6') {
                                        const updatedHistory = m.historicoFinanceiro?.map(h => {
                                          if (h.mes.includes('Maio')) {
                                            return { ...h, status: 'PG' as const };
                                          }
                                          return h;
                                        }) || [];
                                        return { ...m, historicoFinanceiro: updatedHistory };
                                      }
                                      return m;
                                    }));
                                    
                                    // Add to overall cash flow list
                                    const newLancamento = {
                                      id: 'l-' + Date.now().toString(),
                                      descricao: 'Mensalidade Maio - Lucas Augusto',
                                      tipo: 'Entrada' as 'Entrada' | 'Saída',
                                      valor: 100,
                                      data: new Date().toISOString().split('T')[0],
                                      categoria: 'Mensalidade'
                                    };
                                    setLancamentos(prev => [newLancamento, ...prev]);
                                    showNotification('Simulação: Pix copiado e pagamento compensado no caixa geral do Terreiro!', 'success');
                                  }}
                                  className="mt-4 w-full bg-[#FACC15] hover:bg-yellow-400 text-black text-xs font-black py-2 rounded-lg transition-transform hover:scale-[1.02] duration-200 shadow-md text-center inline-block cursor-pointer"
                                >
                                  ⚡ Simular Pagamento PIX
                                </button>
                              );
                            })()}
                          </div>

                          {/* Pix QR Details Block */}
                          <div className="bg-[#12161A] p-4.5 rounded-xl border border-[#1E242B] flex flex-col justify-between">
                            <div className="space-y-2">
                              <span className="text-[8px] uppercase font-bold text-gray-500 tracking-wider">Dados Bancários / Pix Oficial do Zelador</span>
                              <div className="flex items-center gap-2 pt-1">
                                <QrCode className="w-4 h-4 text-[#FACC15]" />
                                <span className="text-[11px] font-black text-white">Chave PIX Litúrgica</span>
                              </div>
                              <div className="bg-[#0D0F12] px-2.5 py-1.5 rounded-lg border border-[#1E242B] flex items-center justify-between gap-1 mt-1.5">
                                <span id="pix-key-val" className="font-mono text-[9px] text-[#FACC15] select-all truncate">pix-financeiro@cabocloventania.org</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText('pix-financeiro@cabocloventania.org');
                                    showNotification('Chave Pix copiada para a área de transferência!', 'success');
                                  }}
                                  className="text-gray-500 hover:text-white p-1 rounded transition-colors shrink-0"
                                  title="Copiar chave PIX"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-[#94A3B8] leading-normal pt-2 font-light border-t border-[#1E242B] mt-2">
                              Favorecido: <span className="text-white font-medium">Templo de Umbanda Caboclo Ventania (Pai Alexandre)</span>
                            </p>
                          </div>
                        </div>

                        {/* PAYMENT HISTORY TABLE */}
                        <div className="space-y-2 pt-2">
                          <h6 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Histórico de Mensalidades Recebidas</h6>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {(() => {
                              const lucasObj = mediums.find(m => m.id === '6') || {
                                historicoFinanceiro: [
                                  { mes: 'Janeiro / 2026', status: 'PG', valor: 100 },
                                  { mes: 'Fevereiro / 2026', status: 'PG', valor: 100 },
                                  { mes: 'Março / 2026', status: 'PG', valor: 100 },
                                  { mes: 'Abril / 2026', status: 'PG', valor: 100 }
                                ]
                              };
                              return lucasObj.historicoFinanceiro?.map((h, idx) => (
                                <div key={idx} className="bg-[#12161A] p-2 rounded-xl border border-[#1E242B] text-center">
                                  <span className="block text-[9px] text-gray-400 font-semibold truncate leading-none">{h.mes.split(' / ')[0]}</span>
                                  <span className="block text-[11px] font-bold text-white mt-1">R$ {h.valor}</span>
                                  <span className={`inline-block text-[8px] px-1.5 py-0.5 rounded-full font-bold mt-1.5 uppercase ${
                                    h.status === 'PG' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/40' : 'bg-red-950/40 text-red-400 border border-red-900/40 animate-pulse'
                                  }`}>
                                    {h.status === 'PG' ? 'PG' : 'ABERTO'}
                                  </span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* LITURGICAL OBLIGATIONS SECTION (Obrigações) */}
                      <div className="bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] space-y-4">
                        <div className="flex items-center justify-between border-b border-[#1E242B] pb-3">
                          <div>
                            <h6 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-[#FACC15]" />
                              Suas Obrigações Litúrgicas & Assentamentos
                            </h6>
                            <p className="text-[11px] text-[#94A3B8]">Cronograma e status dos seus preceitos e iniciação sacerdotal.</p>
                          </div>
                          <span className="text-[9px] text-[#94A3B8] font-mono">Leitura</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(() => {
                            const lucasObj = mediums.find(m => m.id === '6') || {
                              obligacoes: [
                                { id: 'ob1', nome: 'Amaci do Ogã', status: 'Concluído', data: '15/01/2021' },
                                { id: 'ob2', nome: 'Obrigação de 1 Ano de Atabaque', status: 'Concluído', data: '10/01/2022' },
                                { id: 'ob3', nome: 'Obrigação de 3 Anos da Curimba', status: 'Concluído', data: '12/01/2024' },
                                { id: 'ob4', nome: 'Confirmação Geral de Ogã Sacerdotal', status: 'Pendente' }
                              ]
                            };
                            return lucasObj.obligacoes?.map((o) => (
                              <div key={o.id} className="p-3 bg-[#12161A] rounded-xl border border-[#1E242B] flex items-center justify-between gap-1.5">
                                <div>
                                  <span className="block font-bold text-white text-[11px] font-sans">{o.nome}</span>
                                  <span className="text-[9px] text-gray-500">
                                    {o.status === 'Concluído' ? `Consagrado em ${o.data}` : 'Aguardando liberação litúrgica'}
                                  </span>
                                </div>
                                <span className={`text-[8.5px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded ${
                                  o.status === 'Concluído' ? 'bg-[#2E5A44]/20 text-emerald-300 border border-[#2E5A44]/30' : 'bg-yellow-950/40 text-yellow-500 border border-yellow-800/20'
                                }`}>
                                  {o.status === 'Concluído' ? 'Concluído' : 'Aguardando'}
                                </span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                    </div>

                    {/* RIGHT SIDE: ANNOUNCEMENTS & EVENTS (COL 5) */}
                    <div className="lg:col-span-5 space-y-6">

                      {/* MURAL DE COMUNICADOS (AVISOS DO ZELADOR) */}
                      <div className="bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] space-y-4">
                        <div className="border-b border-[#1E242B] pb-3">
                          <h6 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-[#FACC15]" />
                            Mural de Avisos da Corrente
                          </h6>
                          <p className="text-[11px] text-[#94A3B8]">Comunicados oficiais urgentes transmitidos pelo Sacerdote de Santo.</p>
                        </div>

                        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                          {comunicados.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-500">
                              Nenhum comunicado ativo no mural.
                            </div>
                          ) : (
                            comunicados.map((c) => (
                              <div key={c.id} className="bg-[#12161A] p-3.5 rounded-xl border border-[#1E242B] space-y-2">
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                                    c.categoria === 'Preceito' ? 'bg-red-950/40 text-rose-300 border border-red-900/30' :
                                    c.categoria === 'Financeiro' ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/30' :
                                    'bg-blue-950/40 text-blue-300 border border-blue-900/30'
                                  }`}>
                                    {c.categoria}
                                  </span>
                                  <span className="text-[9.5px] text-gray-500 font-mono">{c.data.split('-').reverse().join('/')}</span>
                                </div>
                                <h6 className="text-xs font-bold text-[#F1F5F9]">{c.titulo}</h6>
                                <p className="text-[11px] text-gray-400 font-light leading-relaxed">{c.texto}</p>
                                <div className="text-[9px] text-[#FACC15] font-semibold text-right pt-1.5 border-t border-[#1E242B]/40">
                                  Por: {c.autor}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* UPCOMING EVENTS & GIRAS (CALENDÁRIO DE TRABALHOS) */}
                      <div className="bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] space-y-4">
                        <div className="border-b border-[#1E242B] pb-3">
                          <h6 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-[#FACC15]" />
                            Trabalhos Litúrgicos Agendados
                          </h6>
                          <p className="text-[11px] text-[#94A3B8]">Fique atento às próximas giras de atendimento e preceito geral.</p>
                        </div>

                        <div className="space-y-3">
                          {giras.map((g) => (
                            <div key={g.id} className="bg-[#12161A] p-3 rounded-xl border border-[#1E242B]/80 flex flex-col justify-between">
                              <div className="flex justify-between items-start gap-1">
                                <div>
                                  <span className={`text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                    g.status === 'Especial' ? 'bg-red-950/30 text-rose-300 border border-red-500/15' : 'bg-[#2E5A44]/20 text-emerald-300 border border-[#2E5A44]/30'
                                  }`}>
                                    {g.tipo}
                                  </span>
                                  <h6 className="text-[11.5px] font-bold text-[#F1F5F9] mt-1.5">{g.nome}</h6>
                                </div>
                                <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded ${
                                  g.status === 'Especial' ? 'text-amber-400 bg-amber-500/5' : 'text-emerald-400 bg-emerald-500/5'
                                }`}>
                                  {g.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-gray-400 mt-2.5 pt-2 border-t border-[#1E242B]/50 font-mono">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-gray-500" />
                                  {g.data.split('-').reverse().join('/')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-gray-500" />
                                  {g.horario}h
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                  </div>
                </div>
              ) : (
                <>
                  {/* TAB 0: CONSOLE DE INÍCIO (DASHBOARD OPERACIONAL DO ZELADOR) */}
                  {activeDashboardTab === 'inicio' && (
                    <div className="space-y-8 animate-fadeIn text-[#F1F5F9]">
                      
                      {/* BOAS-VINDAS / BANNER PRINCIPAL */}
                      <div className="relative overflow-hidden bg-gradient-to-r from-amber-950/45 via-[#13171D] to-[#0D0F12] p-8 rounded-3xl border border-amber-500/10 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xl">
                        {/* Glowing background */}
                        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
                        
                        <div className="space-y-3 max-w-2xl relative z-10 text-center lg:text-left">
                          <span className="inline-flex items-center gap-1.5 text-[9px] uppercase font-black tracking-widest px-3 py-1 bg-yellow-950/60 text-[#FACC15] border border-yellow-500/20 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Egrégora Ativa & Protegida
                          </span>
                          <h2 className="font-display font-black text-2xl md:text-3xl text-white tracking-tight">
                            Saravá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FACC15] to-orange-400">{profileName}</span>!
                          </h2>
                          <p className="text-xs md:text-sm text-gray-400 font-light leading-relaxed">
                            O console do Templo Caboclo Ventania está harmonizado. Aqui você gerencia a corrente mediúnica, as obrigações litúrgicas dos filhos de santo, o fluxo financeiro do terreiro e os canais automáticos de aviso.
                          </p>
                          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-[11px] text-gray-500 pt-1">
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-[#FACC15]" />
                              Nível Sacerdotal Completo
                            </span>
                            <span className="text-gray-800">•</span>
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                              42 Filhos de Santo Sincronizados
                            </span>
                          </div>
                        </div>

                        {/* ANCHOR SIMULATION CONTROL PANEL */}
                        <div className="bg-[#12161A]/95 p-5 rounded-2xl border border-[#1E242B] w-full lg:w-72 shrink-0 relative z-10 space-y-4">
                          <span className="block text-[9px] font-extrabold text-gray-450 uppercase tracking-wider mb-2 text-center">Controles Rápidos do Altar</span>
                          
                          <div className="space-y-2.5">
                            <button
                              onClick={() => {
                                showNotification("Sino litúrgico soado no portal dos filhos de santo!", "info");
                                // Spark a tiny sound
                              }}
                              className="w-full bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 rounded-xl p-2.5 text-left transition-all flex items-center justify-between gap-2 text-xs font-bold text-amber-400 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Flame className="w-4 h-4 text-amber-500 fill-amber-500/10 animate-bounce" />
                                <span>Tocar Chamada Litúrgica</span>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                const confirmNotice = window.confirm("Deseja disparar um aviso de resguardo geral para toda a corrente via WhatsApp?");
                                if (confirmNotice) {
                                  showNotification("Mensagem de resguardo disparada para os 42 filhos!", "success");
                                }
                              }}
                              className="w-full bg-emerald-950/40 hover:bg-emerald-950/65 border border-emerald-500/13 rounded-xl p-2.5 text-left transition-all flex items-center justify-between gap-2 text-xs font-bold text-emerald-400 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-emerald-400" />
                                <span>Cobrar Resguardo Geral</span>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* BENTO GRID METRICS OUTLINE */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        
                        {/* CARD 1: LARGE CURRENT MEMBERS */}
                        <div className="bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] hover:border-amber-500/15 transition-all flex flex-col justify-between h-[160px] relative group">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">A Corrente (Médiuns)</span>
                              <div className="w-7 h-7 bg-amber-500/5 group-hover:bg-amber-500/10 rounded-lg flex items-center justify-center transition-colors">
                                <Users className="w-4 h-4 text-[#FACC15]" />
                              </div>
                            </div>
                            <h3 className="text-3xl font-black text-white mt-3 select-all">42 Médiums</h3>
                            <p className="text-[11px] text-[#94A3B8] mt-1">38 Confirmados para a Gira Especial de Junho</p>
                          </div>
                          <button
                            onClick={() => {
                              setActiveDashboardTab('mediums');
                              showNotification("Gerenciamento de Médiuns carregado!");
                            }}
                            className="text-[10px] font-black text-[#FACC15] hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer pt-3 border-t border-[#1E242B]/50"
                          >
                            <span>Gerenciar Corrente</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* CARD 2: LITURGICAL FINANCE OVERVIEW */}
                        <div className="bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] hover:border-emerald-500/15 transition-all flex flex-col justify-between h-[160px] relative group">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Caixa / Mensalidades</span>
                              <div className="w-7 h-7 bg-emerald-500/5 group-hover:bg-emerald-500/10 rounded-lg flex items-center justify-center transition-colors">
                                <Coins className="w-4 h-4 text-emerald-400" />
                              </div>
                            </div>
                            <h3 className="text-3xl font-black text-emerald-400 mt-3 select-all">R$ 4.250</h3>
                            <p className="text-[11px] text-[#94A3B8] mt-1">89% de adimplência na mensalidade de Maio</p>
                          </div>
                          <button
                            onClick={() => {
                              setActiveDashboardTab('financeiro');
                              showNotification("Módulo de Mensalidades & Caixa carregado!");
                            }}
                            className="text-[10px] font-black text-emerald-400 hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer pt-3 border-t border-[#1E242B]/50"
                          >
                            <span>Lançar Balancete</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* CARD 3: LITURGICAL AGENDA CALENDAR */}
                        <div className="bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] hover:border-amber-500/15 transition-all flex flex-col justify-between h-[160px] relative group">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Próxima Gira Ativa</span>
                              <div className="w-7 h-7 bg-red-500/5 group-hover:bg-red-500/10 rounded-lg flex items-center justify-center transition-colors">
                                <Calendar className="w-4 h-4 text-orange-400" />
                              </div>
                            </div>
                            <h3 className="text-xl font-extrabold text-[#F1F5F9] mt-3 line-clamp-1 truncate select-all">Gira de Caboclo</h3>
                            <p className="text-[11px] text-gray-400 mt-1 font-mono">19 de Junho às 20h00</p>
                          </div>
                          <button
                            onClick={() => {
                              setActiveDashboardTab('giras');
                              showNotification("Calendário Litúrgico carregado!");
                            }}
                            className="text-[10px] font-black text-[#FACC15] hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer pt-3 border-t border-[#1E242B]/50"
                          >
                            <span>Configurar Giras</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* CARD 4: MASS MESSAGING WHATSAPP MODULE */}
                        <div className="bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] hover:border-emerald-500/15 transition-all flex flex-col justify-between h-[160px] relative group">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Avisos Automaticos</span>
                              <div className="w-7 h-7 bg-[#10B981]/5 group-hover:bg-[#10B981]/15 rounded-lg flex items-center justify-center transition-colors">
                                <MessageSquare className="w-4 h-4 text-[#10B981]" />
                              </div>
                            </div>
                            <h3 className="text-3xl font-black text-[#10B981] mt-3">Ativo</h3>
                            <p className="text-[11px] text-[#94A3B8] mt-1">Sessão WhatsApp conectada em tempo real</p>
                          </div>
                          <button
                            onClick={() => {
                              setActiveDashboardTab('whatsapp');
                              showNotification("Console de WhatsApp carregado!");
                            }}
                            className="text-[10px] font-black text-[#10B981] hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1 transition-colors pt-3 border-t border-[#1E242B]/50 cursor-pointer"
                          >
                            <span>Fila de Disparos</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                      </div>

                      {/* TWO-COLUMN LOWER REGION OF THE SUMMARY HOME DASHBOARD */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        
                        {/* LEFT COLUMN: CRITICAL LITURGICAL REZOS & INTERACTIVE ALTAR FOR PRAYERS (COL 7) */}
                        <div className="lg:col-span-7 space-y-6">
                          
                          {/* SACRED INTERACTIVE ALTAR FOR PRAYER REQUESTS AND ADVENT VELAS */}
                          <div className="bg-[#13171D] p-6 rounded-3xl border border-[#1E242B] space-y-5">
                            <div className="flex items-center justify-between border-b border-[#1E242B] pb-4">
                              <div>
                                <h4 className="font-display font-black text-sm text-white flex items-center gap-2">
                                  <Heart className="w-4 h-4 text-rose-500 animate-pulse fill-rose-500/20" />
                                  Pedidos de Rezo Coletivos & Firmesa de Velas
                                </h4>
                                <p className="text-xs text-gray-400 mt-0.5">Clique em "Firmar Vela" para consagrar uma vela espiritual para o enfermo ou necessitado.</p>
                              </div>
                              <span className="text-[9.5px] text-rose-400 uppercase font-black bg-rose-950/40 px-2 py-0.5 border border-rose-500/20 rounded">
                                Doações Espirituais
                              </span>
                            </div>

                            {/* FEED OF RECENT PRAYER REQUESTS WITH INTERACTIVE VELA FIRMADO AND LIT SPIRITUAL SOUNDS OR SPARKS */}
                            <div className="space-y-4">
                              {(() => {
                                // Direct render of 3 simulation requests
                                const initialRequests = [
                                  { id: 'req-1', nome: 'Mariana Silva dos Santos', motivo: 'Saúde física e cirurgia de vesícula programada', data: '12/06/2026', velasListed: 3 },
                                  { id: 'req-2', nome: 'José Alencar Ramos', motivo: 'Abertura de caminhos profissionais e desemprego', data: '11/06/2026', velasListed: 1 },
                                  { id: 'req-3', nome: 'Família Mendonça Dias', motivo: 'Harmonização do lar e pacificação familiar', data: '10/06/2026', velasListed: 5 },
                                ];

                                return initialRequests.map((req, idx) => (
                                  <div key={req.id} className="p-4 bg-[#0D0F12] rounded-2xl border border-[#1E242B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="space-y-1.5 max-w-md">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[11.5px] font-black text-white">{req.nome}</span>
                                        <span className="text-[9.5px] text-[#FACC15] font-mono">{req.data}</span>
                                      </div>
                                      <p className="text-[11px] text-gray-400 leading-normal">{req.motivo}</p>
                                    </div>

                                    {/* SIMULATION OF PRAYING INTEGRAL WIDGET */}
                                    <div className="shrink-0 flex items-center gap-3">
                                      <div className="flex items-center gap-1.5 bg-[#13171D] px-2.5 py-1.5 border border-[#1E242B] rounded-xl">
                                        <span className="text-[10px] text-gray-400">Velas:</span>
                                        <span className="text-[11px] font-black text-[#FACC15]">{req.velasListed} 🕯️</span>
                                      </div>
                                      
                                      <button
                                        onClick={(e) => {
                                          req.velasListed += 1;
                                          showNotification(`Vela liturgica firmada com sucesso no congá para ${req.nome}! Sinta a vibração positiva.`, 'success');
                                          // Target button spark feedback
                                          const el = e.currentTarget;
                                          el.style.transform = "scale(0.95)";
                                          setTimeout(() => el.style.transform = "scale(1)", 150);
                                        }}
                                        className="bg-[#2E5A44]/30 hover:bg-[#2E5A44]/60 border border-emerald-500/20 text-[#10B981] px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-tight transition-all active:scale-95 cursor-pointer"
                                      >
                                        🕯️ Firmar Vela
                                      </button>
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>

                          {/* RECENT DISPATCH LOGS AND WORKPLACE BULLETINS */}
                          <div className="bg-[#13171D] p-6 rounded-3xl border border-[#1E242B] space-y-4">
                            <h4 className="font-display font-black text-sm text-[#F1F5F9] border-b border-[#1E242B] pb-3">
                              Últimas Ações Administrativas do Terreiro
                            </h4>
                            <div className="space-y-3">
                              <div className="flex items-start gap-3 text-xs text-gray-400">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                                <div>
                                  <span className="text-[#F1F5F9] font-bold">Mensalidade Lançada:</span> R$ 100,00 registrado para Lucas Augusto de Nanã na referência de Maio.
                                  <span className="block text-[10px] text-gray-550 font-mono mt-0.5">Hoje às 18:42</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 text-xs text-gray-400">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15] shrink-0 mt-1" />
                                <div>
                                  <span className="text-[#F1F5F9] font-bold">Filho Cadastrado:</span> Aline de Iemanjá foi adicionada com sucesso à corrente na categoria de Médium de Apoio.
                                  <span className="block text-[10px] text-gray-550 font-mono mt-0.5">Ontem às 14:15</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 text-xs text-gray-400">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 mt-1" />
                                <div>
                                  <span className="text-[#F1F5F9] font-bold">Resguardo Publicado:</span> "Regras de Resguardo para Gira de Preto Velho" adicionadas ao portal de leitura dos membros.
                                  <span className="block text-[10px] text-gray-550 font-mono mt-0.5">Há 2 dias atrás</span>
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* RIGHT COLUMN: RECENT NEWSLETTER AND DIRECT LAUNCHPADS (COL 5) */}
                        <div className="lg:col-span-5 space-y-6">
                          
                          {/* SACRED DIRETORIA CHAT / INTELLIGENT AI COPILOT LAUNCHPAD (LITERAL LITURGIA LABELS) */}
                          <div className="p-6 bg-gradient-to-b from-[#18132B]/60 to-[#0F0D1C] rounded-3xl border border-[#3E2B85]/20 space-y-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                                <Sparkles className="w-4.5 h-4.5 animate-pulse" />
                              </div>
                              <div>
                                <h4 className="font-display font-black text-sm text-[white] leading-none">Copiloto de Doutrina da Curimba</h4>
                                <span className="text-[9px] uppercase font-bold text-purple-400 tracking-wider">Apoio Tecnológico</span>
                              </div>
                            </div>
                            <p className="text-[11.5px] text-gray-400 font-light leading-relaxed">
                              Dúvidas sobre preceitos, ervas sagradas, defumações corretas ou cânticos de Umbanda? Pergunte ao assistente no chat principal da página.
                            </p>
                            
                            <button
                              onClick={() => {
                                showNotification("Role a tela para cima ou envie uma mensagem no assistente inteligente do plano esquerdo!", "info");
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-black rounded-xl hover:from-purple-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                            >
                              <span>Perguntar ao Assistente de Egrégora</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* LITURGICAL TIPS & CURIMBA CORREGEDORIA */}
                          <div className="bg-[#13171D] p-6 rounded-3xl border border-[#1E242B] space-y-4">
                            <h4 className="font-display font-black text-sm text-yellow-500 flex items-center gap-1">
                              🌿 Dicas de Preceito e Fundamentos
                            </h4>
                            
                            <div className="bg-[#0D0F12] p-4 rounded-xl border border-[#1E242B] space-y-2.5">
                              <span className="text-[9px] font-black uppercase text-[#FACC15] tracking-widest block">Fundamento do Amaci</span>
                              <p className="text-xs text-gray-400 leading-normal font-light">
                                "O amaci deve ser banhado com ervas sagradas frescas do Orixá correspondente ao médium na cabeça antes do nascer do sol, permanecendo em repouso por 24 horas consecutivas para consolidação energética."
                              </p>
                            </div>

                            <div className="bg-[#0D0F12] p-4 rounded-xl border border-[#1E242B] space-y-2.5">
                              <span className="text-[9px] font-black uppercase text-[#FACC15] tracking-widest block">Defumação de Purificação</span>
                              <p className="text-xs text-gray-400 leading-normal font-light">
                                "Inicie sempre a defumação no terreiro de dentro para fora utilizando casca de cebola, alecrim e guiné para afastar miasmas e correntes desequilibradas."
                              </p>
                            </div>
                          </div>

                        </div>

                      </div>

                    </div>
                  )}

                  {/* TAB 1: MEDIUMS CORRENTE */}
                  {activeDashboardTab === 'mediums' && (
                selectedMedium ? (
                  /* PREMIUM REDESIGNED MEMBER PASSPORT (FILHO DE SANTO) */
                  <div className="space-y-6 animate-fadeIn text-[#F1F5F9]">
                    
                    {/* TOP STATS & BREADCRUMB HEADER BAR */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#13171D] px-5 py-3 rounded-xl border border-[#1E242B] text-xs">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setSelectedMedium(null);
                            setIsEditingMediumProfile(false);
                          }}
                          className="text-[#94A3B8] hover:text-[#FACC15] flex items-center gap-1 transition-colors font-bold cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para a Corrente
                        </button>
                        <span className="text-gray-600">/</span>
                        <span className="text-gray-400 font-medium">Perfil Sacerdotal</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-[#FACC15] font-black tracking-wider">{selectedMedium.nome.toUpperCase()}</span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Sessão Segura
                        </span>
                        <span className="text-gray-500 font-mono text-[10px]">Atualizado: Agora mesmo</span>
                      </div>
                    </div>

                    {/* REDESIGNED HEADER PASSPORT CARD */}
                    <div className="relative bg-[#13171D] rounded-2xl border border-[#222B36] overflow-hidden shadow-2xl before:absolute before:inset-0 before:bg-gradient-to-r before:from-[#FACC15]/5 before:to-transparent before:pointer-events-none">
                      {/* Premium Top Glow Accent */}
                      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-[#FACC15] to-amber-600" />
                      
                      <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative">
                        {/* LEFT RAIL: Avatar and Name Passport Details */}
                        <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto">
                          {/* Modern Avatar with Glow Orbit Ring */}
                          <div className="relative">
                            <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-[#1E2530] via-[#12161E] to-[#1E2530] border border-[#2B3545] flex items-center justify-center shadow-xl relative shrink-0">
                              {/* Inner decorative frame circles */}
                              <div className="absolute inset-1 rounded-xl border border-dashed border-[#FACC15]/25 animate-spin-slow pointer-events-none" />
                              <div className="absolute inset-2.5 rounded-lg border border-[#FACC15]/10 pointer-events-none" />
                              
                              <div className="text-center relative">
                                <span className="block text-[9px] tracking-widest text-[#FACC15] font-black leading-none uppercase mb-1.5">TERREIRO</span>
                                <span className="block text-2xl font-display font-black text-white tracking-widest">
                                  {selectedMedium.nome.substring(0, 2).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            
                            {/* Liturgical State Indicator */}
                            <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-[#10B981] text-[#080A0D] font-extrabold text-[9px] uppercase px-3 py-0.5 rounded-full border-2 border-[#13171D] shadow-md tracking-widest whitespace-nowrap">
                              ● ATIVO NA CORRENTE
                            </span>
                          </div>

                          {/* Member Title & Hierarchical Tags */}
                          <div className="text-center sm:text-left space-y-1.5">
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                              <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">{selectedMedium.nome}</h2>
                              <span className="bg-amber-500/10 text-[#FACC15] border border-[#FACC15]/30 text-[10px] font-black px-3 py-0.5 rounded-md uppercase tracking-widest">
                                {selectedMedium.cargo === 'Ogã (Tocador)' ? 'OGÁ DE TAMBOR' : selectedMedium.cargo.toUpperCase()}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-400 font-medium flex items-center justify-center sm:justify-start gap-1.5">
                              <span>Consagrado sob a coroa de</span>
                              <span className="text-[#FACC15] font-semibold">{selectedMedium.orixaFrente || selectedMedium.orixaPai || 'Azansu'}</span>
                            </p>
                            
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-1 text-xs text-[#94A3B8]">
                              <span className="font-mono text-[10.5px] bg-[#1C232E] px-2.5 py-1 rounded-md border border-[#222B36] tracking-wider">
                                REGISTRO: <span className="text-white font-extrabold">{selectedMedium.matricula || 'AXC-2021-352B'}</span>
                              </span>
                              
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                Ficha Integral Verificada
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT RAIL: Global Profile Actions */}
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end border-t border-[#222B36]/50 pt-4 md:pt-0 md:border-0">
                          {/* Back to List */}
                          <button
                            onClick={() => {
                              setSelectedMedium(null);
                              setIsEditingMediumProfile(false);
                            }}
                            className="p-3 rounded-xl bg-[#1C222B] hover:bg-[#252F3C] border border-[#2B3645] text-gray-400 hover:text-white transition-all shadow-md group cursor-pointer"
                            title="Voltar para a Lista de Médiuns"
                          >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                          </button>

                          {/* Quick Whatsapp Action Trigger */}
                          {selectedMedium.whatsapp && selectedMedium.whatsapp !== 'Aguardando preenchimento' && (
                            <a
                              href={`https://wa.me/${selectedMedium.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3 rounded-xl bg-[#12161A] hover:bg-[#1C222B] border border-[#1E242B] text-[#10B981] hover:text-emerald-400 transition-all shadow-md cursor-pointer flex items-center"
                              title="Enviar WhatsApp"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}

                          {/* Redesigned Edit Button */}
                          <button
                            onClick={() => {
                              if (isEditingMediumProfile) {
                                setMediums(prev => prev.map(m => m.id === selectedMedium.id ? selectedMedium : m));
                                setIsEditingMediumProfile(false);
                                showNotification(`Alterações salvas com sucesso na ficha de ${selectedMedium.nome}!`, 'success');
                              } else {
                                setIsEditingMediumProfile(true);
                                showNotification('Modo de edição rápida ativado!', 'info');
                              }
                            }}
                            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                              isEditingMediumProfile
                                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-950/20'
                                : 'border-[#FACC15] bg-[#FACC15]/5 text-[#FACC15] hover:bg-[#FACC15]/10 shadow-sm shadow-[#FACC15]/5 font-black uppercase tracking-wider'
                            }`}
                          >
                            {isEditingMediumProfile ? (
                              <>
                                <Check className="w-4 h-4" />
                                Salvar Alterações
                              </>
                            ) : (
                              <>
                                <Pencil className="w-4 h-4 animate-bounce" />
                                Editar Informações
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* REDESIGNED NAVIGATION TABS WITH GLOW STRIPS */}
                    <div className="flex bg-[#12161A] p-1.5 rounded-xl border border-[#1E242B] gap-1 overflow-x-auto">
                      {(['info', 'obrigacao', 'financeiro', 'notas'] as const).map((tab) => {
                        const active = mediumProfileTab === tab;
                        const label = tab === 'info' ? 'Dados Cadastrais' : tab === 'obrigacao' ? 'Evolução Espiritual' : tab === 'financeiro' ? 'Financeiro / Mensalidades' : 'Anotações Sacramentais';
                        return (
                          <button
                            key={tab}
                            onClick={() => setMediumProfileTab(tab)}
                            className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all relative shrink-0 flex items-center gap-2 cursor-pointer ${
                              active
                                ? 'bg-[#FACC15] text-[#080A0D] shadow-md font-black'
                                : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {tab === 'info' && <User className="w-3.5 h-3.5" />}
                            {tab === 'obrigacao' && <Sparkles className="w-3.5 h-3.5" />}
                            {tab === 'financeiro' && <Coins className="w-3.5 h-3.5" />}
                            {tab === 'notas' && <FileText className="w-3.5 h-3.5" />}
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* TAB DISPLAYS - FULL REDESIGN WORKSPACE */}
                    <div className="animate-fadeIn min-h-[400px]">
                      
                      {/* TAB 1: CADASTROS & DADOS CADASTRAIS (BENTO GRAPHIC LAYOUT) */}
                      {mediumProfileTab === 'info' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                          
                          {/* PANEL A (COL-SPAN-2): Sacerdócio & Coroa Espiritual (Orbit Cards) */}
                          <div className="md:col-span-2 bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] flex flex-col justify-between space-y-6">
                            <div>
                              <div className="flex items-center justify-between border-b border-[#222B36] pb-3.5">
                                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-[#FACC15]" />
                                  Coroa Espiritual e Sacerdócio
                                </h4>
                                <span className="text-[10px] font-mono text-gray-500 uppercase">Liturgia nº {selectedMedium.matricula || 'AXC-2021-352B'}</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5">
                                {/* Orixá Frente Orbit Display */}
                                <div className="p-4 rounded-xl bg-gradient-to-br from-[#1E2530] to-[#12161E] border border-[#2B3545] relative overflow-hidden group">
                                  <div className="absolute right-3 top-3 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold text-xs">
                                    1º
                                  </div>
                                  <span className="block text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Orixá de Frente</span>
                                  {isEditingMediumProfile ? (
                                    <input
                                      type="text"
                                      value={selectedMedium.orixaFrente || ''}
                                      onChange={(e) => setSelectedMedium({ ...selectedMedium, orixaFrente: e.target.value })}
                                      className="w-full text-xs p-2 rounded bg-[#0D0F12] border border-[#1E242B] text-white focus:outline-none focus:border-[#FACC15] font-bold"
                                    />
                                  ) : (
                                    <span className="block font-display font-black text-lg text-[#FACC15] tracking-tight">
                                      {selectedMedium.orixaFrente || selectedMedium.orixaPai || 'Azansu'}
                                    </span>
                                  )}
                                  <span className="block text-[10px] text-gray-500 mt-2 font-light">Guia e regente primordial nos aspectos mentais e rituais.</span>
                                </div>

                                {/* Orixá Adjuntó displaying */}
                                <div className="p-4 rounded-xl bg-gradient-to-br from-[#1E2530] to-[#12161E] border border-[#2B3545] relative overflow-hidden group">
                                  <div className="absolute right-3 top-3 w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-450 text-[#FACC15] font-bold text-xs">
                                    2º
                                  </div>
                                  <span className="block text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Orixá Adjuntó (Equilibrista)</span>
                                  {isEditingMediumProfile ? (
                                    <input
                                      type="text"
                                      value={selectedMedium.adjunto || ''}
                                      onChange={(e) => setSelectedMedium({ ...selectedMedium, adjunto: e.target.value })}
                                      className="w-full text-xs p-2 rounded bg-[#0D0F12] border border-[#1E242B] text-white focus:outline-none focus:border-[#FACC15] font-bold"
                                    />
                                  ) : (
                                    <span className={`block font-display font-black text-lg ${selectedMedium.adjunto && selectedMedium.adjunto !== 'Aguardando preenchimento' ? 'text-white' : 'text-gray-500 italic font-normal'}`}>
                                      {selectedMedium.adjunto || 'Aguardando preenchimento'}
                                    </span>
                                  )}
                                  <span className="block text-[10px] text-gray-500 mt-2 font-light">Atua em complementação de energia com o orixá de frente.</span>
                                </div>

                                {/* Data de Entrada */}
                                <div className="p-4 rounded-xl bg-[#12161A]/65 border border-[#1E242B] space-y-1">
                                  <span className="block text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-[#FACC15]" /> Data de Entrada Oficial
                                  </span>
                                  {isEditingMediumProfile ? (
                                    <input
                                      type="text"
                                      value={selectedMedium.dataEntrada || ''}
                                      onChange={(e) => setSelectedMedium({ ...selectedMedium, dataEntrada: e.target.value })}
                                      className="w-full text-xs p-2 rounded bg-[#0D0F12] border border-[#1E242B] text-white focus:outline-none focus:border-[#FACC15]"
                                    />
                                  ) : (
                                    <span className="block font-display font-extrabold text-sm text-[#F1F5F9]">
                                      {selectedMedium.dataEntrada || '02/01/2021'}
                                    </span>
                                  )}
                                </div>

                                {/* Data de Feitura */}
                                <div className="p-4 rounded-xl bg-[#12161A]/65 border border-[#1E242B] space-y-1">
                                  <span className="block text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-[#FACC15]" /> Data de Feitura (Sagração)
                                  </span>
                                  {isEditingMediumProfile ? (
                                    <input
                                      type="text"
                                      value={selectedMedium.dataFeitura || ''}
                                      onChange={(e) => setSelectedMedium({ ...selectedMedium, dataFeitura: e.target.value })}
                                      className="w-full text-xs p-2 rounded bg-[#0D0F12] border border-[#1E242B] text-white focus:outline-none focus:border-[#FACC15]"
                                    />
                                  ) : (
                                    <span className={`block font-display font-extrabold text-sm ${selectedMedium.dataFeitura && selectedMedium.dataFeitura !== 'Aguardando preenchimento' ? 'text-white' : 'text-gray-500 italic font-normal'}`}>
                                      {selectedMedium.dataFeitura || 'Aguardando preenchimento'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Initiated Progress scale details */}
                            <div className="bg-[#12161A] p-4 rounded-xl border border-[#1E242B]/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                              <div className="space-y-1 text-center sm:text-left">
                                <span className="block text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest leading-none">Maturação Litúrgica</span>
                                <span className="block text-xs font-black text-white">Tempo de Ritualística do Filho de Santo</span>
                              </div>
                              <div className="w-full sm:w-1/2 flex items-center gap-3">
                                <div className="flex-1 h-2 rounded-full bg-[#1A222B] overflow-hidden relative border border-white/5">
                                  <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-amber-500 to-[#FACC15] rounded-full" style={{ width: '85%' }} />
                                </div>
                                <span className="font-mono text-xs font-black text-[#FACC15]">85% (5 Anos)</span>
                              </div>
                            </div>
                          </div>

                          {/* PANEL B: Dados Pessoais & Documentos (Passport design) */}
                          <div className="bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] space-y-6 flex flex-col justify-between">
                            <div className="space-y-5">
                              <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-[#222B36] pb-3.5">
                                <User className="w-4 h-4 text-[#FACC15]" />
                                Cadastro Civil
                              </h4>

                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <span className="block text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">Nascimento</span>
                                  {isEditingMediumProfile ? (
                                    <input
                                      type="text"
                                      value={selectedMedium.dataNascimento || ''}
                                      onChange={(e) => setSelectedMedium({ ...selectedMedium, dataNascimento: e.target.value })}
                                      className="w-full text-xs p-2.5 rounded bg-[#0D0F12] border border-[#1E242B] text-white focus:outline-none focus:border-[#FACC15]"
                                    />
                                  ) : (
                                    <span className="font-display font-extrabold text-[#F1F5F9] text-sm">{selectedMedium.dataNascimento || '03/06/1994'}</span>
                                  )}
                                </div>

                                <div className="space-y-1">
                                  <span className="block text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">CPF Registrado</span>
                                  {isEditingMediumProfile ? (
                                    <input
                                      type="text"
                                      value={selectedMedium.cpf || ''}
                                      onChange={(e) => setSelectedMedium({ ...selectedMedium, cpf: e.target.value })}
                                      className="w-full text-xs p-2.5 rounded bg-[#0D0F12] border border-[#1E242B] text-white focus:outline-none focus:border-[#FACC15]"
                                    />
                                  ) : (
                                    <span className="font-mono font-medium text-gray-300 text-sm select-all">{selectedMedium.cpf || 'Aguardando preenchimento'}</span>
                                  )}
                                </div>

                                <div className="space-y-1">
                                  <span className="block text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">Localização / Residência</span>
                                  {isEditingMediumProfile ? (
                                    <input
                                      type="text"
                                      value={selectedMedium.endereco || ''}
                                      onChange={(e) => setSelectedMedium({ ...selectedMedium, endereco: e.target.value })}
                                      className="w-full text-xs p-2.5 rounded bg-[#0D0F12] border border-[#1E242B] text-white focus:outline-none focus:border-[#FACC15]"
                                    />
                                  ) : (
                                    <p className={`text-xs ${selectedMedium.endereco && selectedMedium.endereco !== 'Aguardando preenchimento' ? 'text-gray-300 font-medium' : 'text-gray-500 italic'}`}>
                                      {selectedMedium.endereco || 'Aguardando preenchimento'}
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-1">
                                  <span className="block text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">WhatsApp de Contato</span>
                                  {isEditingMediumProfile ? (
                                    <input
                                      type="text"
                                      value={selectedMedium.whatsapp || ''}
                                      onChange={(e) => setSelectedMedium({ ...selectedMedium, whatsapp: e.target.value })}
                                      className="w-full text-xs p-2.5 rounded bg-[#0D0F12] border border-[#1E242B] text-white focus:outline-none focus:border-[#FACC15]"
                                    />
                                  ) : (
                                    <p className={`text-xs ${selectedMedium.whatsapp && selectedMedium.whatsapp !== 'Aguardando preenchimento' ? 'text-gray-300 font-medium' : 'text-gray-500 italic'}`}>
                                      {selectedMedium.whatsapp || 'Aguardando preenchimento'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Secure System token identification */}
                            <div className="pt-4 border-t border-[#222B36] space-y-1.5">
                              <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest">Token de Vínculo de Usuário</span>
                              <span className="block font-mono text-[9px] text-[#94A3B8] bg-[#0D0F12] p-2 rounded-lg border border-[#1E242B] leading-none break-all select-all font-semibold">
                                {selectedMedium.vinculoUsuario || 'a3112f98-9384-4f04-a922-24e19deaf0ea'}
                              </span>
                            </div>
                          </div>

                        </div>
                      )}

                      {/* EXTRA DETAILED CARD FOR GENERAL INFO OR TAB: QUIZILAS & PRECEITOS */}
                      {mediumProfileTab === 'info' && (
                        <div className="mt-6 bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] space-y-4">
                          <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-[#222B36] pb-3.5">
                            <Flame className="w-4 h-4 text-[#FACC15]" />
                            Quizilas, Interdições & Preceitos Litúrgicos de Cabeça
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                            <div className="md:col-span-3 space-y-2">
                              <span className="block text-[9.5px] font-bold text-amber-500 uppercase tracking-widest font-mono">EW_S & RESTRIÇÕES ESPIRITUAIS</span>
                              {isEditingMediumProfile ? (
                                <textarea
                                  rows={2}
                                  value={selectedMedium.quizilas || ''}
                                  onChange={(e) => setSelectedMedium({ ...selectedMedium, quizilas: e.target.value })}
                                  className="w-full text-xs p-3 rounded-lg bg-[#0D0F12] border border-[#1E242B] text-white focus:outline-none focus:border-[#FACC15] resize-none"
                                  placeholder="Ex: Quizilas alimentares, sementes ou cores de santos..."
                                />
                              ) : (
                                <p className={`text-xs leading-relaxed ${selectedMedium.quizilas && selectedMedium.quizilas !== 'Aguardando preenchimento' ? 'text-gray-300 font-medium' : 'text-gray-500 italic'}`}>
                                  {selectedMedium.quizilas || 'Nenhuma restrição registrada de preceito para o Filho de Santo.'}
                                </p>
                              )}
                            </div>

                            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-505/10 to-amber-950/20 bg-amber-950/20 border border-amber-500/20 text-center space-y-1 h-full flex flex-col justify-center">
                              <span className="block text-xs font-black text-[#FACC15] uppercase tracking-wider">Atenção no Congá</span>
                              <span className="block text-[10px] text-gray-400 font-light">Respeitar as restrições alimentares do Orixá nas datas festivas.</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 2: OBRIGAÇÃO (RITUAL TIMELINE CHRONOLOGY) */}
                      {mediumProfileTab === 'obrigacao' && (
                        <div className="bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] space-y-6">
                          <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Flame className="w-4 h-4 text-[#FACC15]" />
                              Evolução & Deveres Litúrgicos
                            </h4>
                            <p className="text-xs text-[#94A3B8] mt-1 font-light">Controle cronológico sacerdotal de obrigações sacramentais periódicas e confirmações internas.</p>
                          </div>

                          <div className="relative border-l-2 border-[#1E242B] pl-8 ml-4 space-y-8 py-2">
                            {(selectedMedium.obligacoes || [
                              { id: 'ob1', nome: 'Amaci do Ogã', status: 'Concluído', data: '15/01/2021' },
                              { id: 'ob2', nome: 'Obrigação de 1 Ano de Atabaque', status: 'Concluído', data: '10/01/2022' },
                              { id: 'ob3', nome: 'Obrigação de 3 Anos da Curimba', status: 'Concluído', data: '12/01/2024' },
                              { id: 'ob4', nome: 'Confirmação Geral de Ogã Sacerdotal', status: 'Pendente' }
                            ]).map((ob) => {
                              const done = ob.status === 'Concluído';
                              return (
                                <div key={ob.id} className="relative group">
                                  {/* Absolute Timeline Dot */}
                                  <div className={`absolute -left-[41px] top-1.5 w-6 h-6 rounded-full border-2 bg-[#13171D] transition-colors flex items-center justify-center ${
                                    done ? 'border-[#FACC15] text-[#FACC15]' : 'border-[#222B36] text-gray-700'
                                  }`}>
                                    {done ? <Check className="w-3 h-3 font-bold" /> : <Clock className="w-3 h-3" />}
                                  </div>

                                  <div className="bg-[#12161A] p-4 rounded-xl border border-[#1E242B] hover:border-[#FACC15]/20 hover:bg-[#1A222B]/35 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                      <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        {ob.nome}
                                      </h5>
                                      <p className="text-[11px] text-gray-500 font-light">
                                        {done ? `Sacramento realizado e firmado espiritualmente em: ${ob.data}` : 'Aguardando maturidade de tempo de santo na corrente.'}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      {isEditingMediumProfile ? (
                                        <button
                                          onClick={() => {
                                            const updatedObligacoes = (selectedMedium.obligacoes || []).map(o => {
                                              if (o.id === ob.id) {
                                                const newStatus = o.status === 'Concluído' ? 'Pendente' : 'Concluído';
                                                return {
                                                  ...o,
                                                  status: newStatus as 'Concluído' | 'Pendente',
                                                  data: newStatus === 'Concluído' ? new Date().toLocaleDateString('pt-BR') : undefined
                                                };
                                              }
                                              return o;
                                            });
                                            const revisedMedium = { ...selectedMedium, obligacoes: updatedObligacoes };
                                            setSelectedMedium(revisedMedium);
                                            setMediums(prev => prev.map(m => m.id === selectedMedium.id ? revisedMedium : m));
                                            showNotification(`Alterada situação do sacramento da obrigação.`);
                                          }}
                                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-colors ${
                                            done ? 'bg-amber-950/30 text-[#FACC15] border-amber-500/20' : 'bg-[#181C21] text-gray-400 border-[#1E242B]'
                                          }`}
                                        >
                                          Alternar Estado
                                        </button>
                                      ) : (
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                          done
                                            ? 'bg-amber-950/40 text-[#FACC15] border-amber-500/30'
                                            : 'bg-[#181C21] text-gray-600 border-[#1E242B]'
                                        }`}>
                                          {ob.status}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* TAB 3: FINANCEIRO (PAYMENT LEDGER REDESIGN) */}
                      {mediumProfileTab === 'financeiro' && (
                        <div className="bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] space-y-6">
                          
                          {/* Financial KPIs Header */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-[#12161A] p-4.5 rounded-xl border border-[#1E242B] space-y-1">
                              <span className="block text-[8.5px] font-bold text-gray-500 uppercase tracking-widest">MENSALIDADE FIXA</span>
                              <span className="block text-xl font-display font-black text-[#FACC15]">R$ 100,00</span>
                              <span className="block text-[10px] text-emerald-400">Contábil Litúrgico Ativo</span>
                            </div>

                            <div className="bg-[#12161A] p-4.5 rounded-xl border border-[#1E242B] space-y-1">
                              <span className="block text-[8.5px] font-bold text-gray-500 uppercase tracking-widest">SITUAÇÃO DO ANO 2026</span>
                              <span className="block text-xl font-display font-black text-emerald-400">
                                {((selectedMedium.historicoFinanceiro || []).filter(f => f.status === 'PG').length / 5 * 100).toFixed(0)}% Pago
                              </span>
                              <span className="block text-[10px] text-gray-500">Médiuns com mensalidades regulares</span>
                            </div>

                            <div className="bg-[#12161A] p-4.5 rounded-xl border border-[#1E242B] space-y-1">
                              <span className="block text-[8.5px] font-bold text-gray-500 uppercase tracking-widest">ARRECADADO ACUMULADO</span>
                              <span className="block text-xl font-display font-black text-white">
                                R$ {((selectedMedium.historicoFinanceiro || []).filter(f => f.status === 'PG').length * 100).toFixed(2)}
                              </span>
                              <span className="block text-[10px] text-gray-400">Soma de parcelas compensadas</span>
                            </div>
                          </div>

                          {/* Redesigned Payment grid cards */}
                          <div className="space-y-4 pt-2">
                            <div>
                              <h5 className="text-xs font-black text-white uppercase tracking-wider">Histórico de Quitação de Encomendas & Mensalidades</h5>
                              <p className="text-[11px] text-[#94A3B8] font-light">Clique em um dos meses do quadro abaixo para simular / computar a quitação sacerdotal direta.</p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
                              {(selectedMedium.historicoFinanceiro || [
                                { mes: 'Janeiro / 2026', status: 'PG', valor: 100 },
                                { mes: 'Fevereiro / 2026', status: 'PG', valor: 100 },
                                { mes: 'Março / 2026', status: 'PG', valor: 100 },
                                { mes: 'Abril / 2026', status: 'PG', valor: 100 },
                                { mes: 'Maio / 2026', status: 'Aberto', valor: 100 }
                              ]).map((hm, idx) => {
                                const paid = hm.status === 'PG';
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => {
                                      const updatedHistory = (selectedMedium.historicoFinanceiro || []).map((f, fIdx) => {
                                        if (fIdx === idx) {
                                          const nextStatus = f.status === 'PG' ? 'Aberto' : 'PG';
                                          return { ...f, status: nextStatus as 'PG' | 'Aberto' };
                                        }
                                        return f;
                                      });
                                      const modifiedMedium = { ...selectedMedium, historicoFinanceiro: updatedHistory };
                                      setSelectedMedium(modifiedMedium);
                                      setMediums(prev => prev.map(m => m.id === selectedMedium.id ? modifiedMedium : m));
                                      showNotification(`${hm.mes} atualizado para ${hm.status === 'PG' ? 'Aberto' : 'Pago'}.`);
                                    }}
                                    className={`p-4 rounded-xl border text-center transition-all cursor-pointer select-none relative ${
                                      paid
                                        ? 'bg-gradient-to-b from-amber-505/10 to-amber-950/20 bg-amber-950/20 border-amber-500/40 text-[#FACC15] shadow-lg shadow-amber-950/5 hover:scale-102'
                                        : 'bg-[#12161A] border-[#222B36] text-gray-500 hover:border-[#FACC15]/40 hover:scale-101'
                                    }`}
                                  >
                                    <span className="block text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-1.5">{hm.mes}</span>
                                    <span className="block text-[15px] font-black">R$ {hm.valor.toFixed(2)}</span>
                                    
                                    <span className={`inline-block mt-3 text-[9px] font-black uppercase px-2.5 py-0.5 rounded ${
                                      paid ? 'bg-amber-500/20 text-[#FACC15]' : 'bg-[#1D242D] text-gray-600'
                                    }`}>
                                      {paid ? 'QUITADO (PG)' : 'EM ABERTO'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="bg-[#12161A] p-4 rounded-xl border border-[#1E242B] text-[11px] text-gray-400 flex items-start gap-2 leading-relaxed">
                            <Info className="w-4 h-4 text-[#FACC15] shrink-0 mt-0.5" />
                            <span>
                              <strong>Aviso Litúrgico de Tesouraria:</strong> O caixa da casa destina-se inteiramente à aquisição de insumos comunitários de giras (velas, ervas, defumadores, flores e reformas estruturais). Filhos de santo com mensalidades pendentes de mais de 3 meses devem contatar a Zeladoria diretamente.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* TAB 4: NOTAS CONFIDENCIAIS DA ZELADORIA COGNITIVE BOOK */}
                      {mediumProfileTab === 'notas' && (
                        <div className="bg-[#13171D] p-6 rounded-2xl border border-[#1E242B] space-y-6">
                          <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#FACC15]" />
                              Diário de Conduta e Apontamentos do Sacerdote
                            </h4>
                            <p className="text-xs text-[#94A3B8] mt-1 font-light">Notas confidenciais sobre caridade, toques, comportamentos em gira e desenvolvimento mediúnico arquivados pelo Zelador de Santo.</p>
                          </div>

                          {/* Notes Cards listing */}
                          <div className="space-y-4">
                            {(selectedMedium.anotacoesZeladoria || []).length === 0 ? (
                              <div className="p-10 text-center text-gray-500 text-xs italic border border-dashed border-[#1E242B] rounded-2xl bg-[#12161A]">
                                Nenhuma consideração pastoral registrada para {selectedMedium.nome}.
                              </div>
                            ) : (
                              (selectedMedium.anotacoesZeladoria || []).map((an) => (
                                <div key={an.id} className="p-4 bg-[#12161A] rounded-xl border border-[#1E242B] space-y-2 relative overflow-hidden group">
                                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FACC15]" />
                                  <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                                    <span className="font-extrabold text-[#FACC15] uppercase tracking-wider">Autor: {an.autor}</span>
                                    <span>{an.data}</span>
                                  </div>
                                  <p className="text-gray-300 text-xs leading-relaxed font-light">{an.texto}</p>
                                </div>
                              ))
                            )}
                          </div>

                          {/* New Confidential note formulation */}
                          <div className="pt-4 border-t border-[#222B36] space-y-3">
                            <span className="block text-[10px] font-extrabold text-amber-500 uppercase tracking-widest font-mono">Novo Registro Litúrgico Secreto</span>
                            <textarea
                              rows={2}
                              value={newProfileNote}
                              onChange={(e) => setNewProfileNote(e.target.value)}
                              placeholder="Fatos observados na incorporação, assiduidade, empenho litúrgico em giras, zelos com o Congá, preceitos, ocorrências rituais..."
                              className="w-full text-xs p-3 rounded-lg border border-[#1E242B] bg-[#0D0F12] text-white focus:outline-none focus:ring-1 focus:ring-[#FACC15] focus:border-[#FACC15] placeholder:text-gray-600"
                            />
                            
                            <div className="flex justify-end">
                              <button
                                onClick={() => {
                                  if (!newProfileNote.trim()) {
                                    showNotification('Por favor, digite a anotação espiritual antes de gravar.', 'error');
                                    return;
                                  }
                                  const newNoteObj = {
                                    id: 'an-' + Date.now().toString(),
                                    data: new Date().toLocaleDateString('pt-BR'),
                                    texto: newProfileNote,
                                    autor: 'Pai Alexandre'
                                  };
                                  const updatedNotes = [...(selectedMedium.anotacoesZeladoria || []), newNoteObj];
                                  const updatedMedium = { ...selectedMedium, anotacoesZeladoria: updatedNotes };
                                  setSelectedMedium(updatedMedium);
                                  setMediums(prev => prev.map(m => m.id === selectedMedium.id ? updatedMedium : m));
                                  setNewProfileNote('');
                                  showNotification('Crônica litúrgica gravada com sucesso no diário do Pai de Santo!', 'success');
                                }}
                                className="px-5 py-2.5 bg-[#FACC15] hover:bg-[#FDE047] text-[#080A0D] text-xs font-black rounded-lg transition-all cursor-pointer shadow-md uppercase tracking-wider"
                              >
                                Gravar em Livro Sacerdotal secreto
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* REGULAR LIST OF MEDIUMS AND THE ADDITION FORM */
                  <div className="space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <h5 className="font-display font-bold text-lg text-[#F1F5F9]">Fichas Litúrgicas da Corrente</h5>
                        <p className="text-xs text-[#94A3B8]">Médiuns em desenvolvimento, confirmados e cargos litúrgicos. Clique na linha do médium para ver sua Ficha Completa Redesenhada.</p>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#94A3B8]" />
                        <input
                          type="text"
                          placeholder="Buscar médium por nome..."
                          value={searchMedium}
                          onChange={(e) => setSearchMedium(e.target.value)}
                          className="pl-9 pr-4 py-2 text-xs rounded-xl border border-[#1E242B] focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-[#FACC15] w-full sm:w-64 bg-[#12161A] text-[#F1F5F9]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Add Medium Form */}
                      <div className="bg-[#13171D] p-5 rounded-2xl border border-[#1E242B]" id="form-cadastrar-medium">
                        <h6 className="font-bold text-sm text-[#F1F5F9] mb-4 flex items-center gap-1.5">
                          <Plus className="w-4 h-4 text-[#FACC15]" />
                          Adicionar Médium na Corrente
                        </h6>
                        
                        <form onSubmit={handleAddMedium} className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Nome Completo</label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: Mariana de Iansã"
                              value={newMedium.nome}
                              onChange={(e) => setNewMedium({ ...newMedium, nome: e.target.value })}
                              className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none placeholder:text-gray-600"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Cargo Espiritual</label>
                            <select
                              value={newMedium.cargo}
                              onChange={(e) => setNewMedium({ ...newMedium, cargo: e.target.value })}
                              className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                            >
                              <option value="Médium de Desenvolvimento">Médium de Desenvolvimento</option>
                              <option value="Zelador de Santo (Pai/Mãe de Santo)">Zelador (Pai/Mãe de Santo)</option>
                              <option value="Ogã (Curimba)">Ogã (Curimba)</option>
                              <option value="Cambone (Auxiliar)">Cambone (Auxiliar)</option>
                              <option value="Médium Iniciante">Médium Iniciante / Corrente</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-[#E1D4C6] uppercase mb-1">Orixá Pai</label>
                              <select
                                value={newMedium.orixaPai}
                                onChange={(e) => setNewMedium({ ...newMedium, orixaPai: e.target.value })}
                                className="w-full text-[11px] p-2 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                              >
                                <option value="Ogum">Ogum</option>
                                <option value="Oxóssi">Oxóssi</option>
                                <option value="Xangô">Xangô</option>
                                <option value="Oxalá">Oxalá</option>
                                <option value="Obaluaiê">Obaluaiê</option>
                                <option value="Oxumaré">Oxumaré</option>
                                <option value="Azansu">Azansu</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-[#E1D4C6] uppercase mb-1">Orixá Mãe</label>
                              <select
                                value={newMedium.orixaMae}
                                onChange={(e) => setNewMedium({ ...newMedium, orixaMae: e.target.value })}
                                className="w-full text-[11px] p-2 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                              >
                                <option value="Oxum">Oxum</option>
                                <option value="Iansã">Iansã</option>
                                <option value="Yemanjá">Yemanjá</option>
                                <option value="Nanã">Nanã</option>
                                <option value="Obá">Obá</option>
                                <option value="Egunitá">Egunitá</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-[#E1D4C6] uppercase mb-1">Guia / Mentor Principal (Se houver)</label>
                            <input
                              type="text"
                              placeholder="Ex: Caboclo Penacho Violeta"
                              value={newMedium.guiaEspiritual}
                              onChange={(e) => setNewMedium({ ...newMedium, guiaEspiritual: e.target.value })}
                              className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none placeholder:text-gray-600"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-[#E1D4C6] uppercase mb-1">Status Litúrgico</label>
                            <select
                              value={newMedium.status}
                              onChange={(e) => setNewMedium({ ...newMedium, status: e.target.value as any })}
                              className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                            >
                              <option value="Ativo">Ativo na Corrente</option>
                              <option value="Especial">Em Obrigação / Retiro</option>
                              <option value="Afastado">Afastado Temporariamente</option>
                            </select>
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-[#FACC15] hover:bg-[#FDE047] text-[#080A0D] text-xs font-bold py-2.5 rounded-lg transition-all mt-4 shadow-md text-center inline-block"
                          >
                            Salvar na Nuvem
                          </button>
                        </form>
                      </div>

                      {/* Mediums List (Interactive Grid) */}
                      <div className="lg:col-span-2 space-y-3">
                        <div className="bg-[#13171D] rounded-2xl border border-[#1E242B] overflow-hidden">
                          <table className="min-w-full divide-y divide-[#1E242B]">
                            <thead className="bg-[#12161A]">
                              <tr>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Médium</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Cargo Litúrgico</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Orixás (Pai / Mãe)</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Mentor</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="bg-[#13171D] divide-y divide-[#1E242B] table-body-mediums animate-fadeIn">
                              {mediums
                                .filter(m => m.nome.toLowerCase().includes(searchMedium.toLowerCase()))
                                .map((m) => (
                                  <tr
                                    key={m.id}
                                    onClick={() => {
                                      setSelectedMedium(m);
                                      setMediumProfileTab('info');
                                      setIsEditingMediumProfile(false);
                                      showNotification(`Ficha espiritual de ${m.nome} aberta com sucesso!`, 'info');
                                    }}
                                    className="hover:bg-[#1E242B]/75 text-xs transition-colors cursor-pointer group"
                                  >
                                    <td className="px-4 py-3.5 whitespace-nowrap font-medium text-[#F1F5F9]">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-full ${m.avatarColor} flex items-center justify-center font-black text-[10px]`}>
                                          {m.nome.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span className="group-hover:text-[#FACC15] transition-colors">{m.nome}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3.5 text-[#94A3B8]">{m.cargo}</td>
                                    <td className="px-4 py-3.5">
                                      <span className="inline-flex gap-1 items-center bg-[#12161A] py-0.5 px-1.5 rounded text-[10.5px] border border-[#1E242B]">
                                        <span className="font-semibold text-rose-450 text-rose-450">{m.orixaPai}</span>
                                        <span className="text-gray-500 font-light">|</span>
                                        <span className="font-semibold text-[#FACC15]">{m.orixaMae}</span>
                                      </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-[#94A3B8] italic">{m.guiaEspiritual}</td>
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                        m.status === 'Ativo' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-850' :
                                        m.status === 'Em Obrigação' ? 'bg-amber-950/60 text-amber-300 border border-amber-850' :
                                        'bg-neutral-800 text-neutral-300 border border-neutral-700'
                                      }`}>
                                        {m.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={() => {
                                            setSelectedMedium(m);
                                            setMediumProfileTab('info');
                                            setIsEditingMediumProfile(false);
                                          }}
                                          className="p-1 bg-[#1A222B] text-amber-500 hover:text-amber-400 rounded text-[10px] font-bold px-2 py-0.5 border border-amber-500/20"
                                          title="Visualizar Ficha"
                                        >
                                          Ficha
                                        </button>
                                        <button
                                          id={`btn-del-medium-${m.id}`}
                                          onClick={() => handleDeleteMedium(m.id, m.nome)}
                                          className="p-1 text-red-400 hover:text-red-300 hover:bg-white/5 rounded"
                                          title="Desligar médium"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              }
                              {mediums.filter(m => m.nome.toLowerCase().includes(searchMedium.toLowerCase())).length === 0 && (
                                <tr>
                                  <td colSpan={6} className="px-4 py-12 text-center text-[#94A3B8]">
                                    Nenhum médium corresponde à busca "<strong>{searchMedium}</strong>".
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center gap-1.5 p-3.5 bg-[#12161A] rounded-xl border border-[#1E242B] text-[11px] text-[#94A3B8]">
                          <Info className="w-3.5 h-3.5 text-[#FACC15] flex-shrink-0" />
                          <span>Clique em qualquer linha acima para carregar o novo perfil redesenhado interativo do médium da casa.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* TAB 2: FINANCEIRO LEDGER */}
              {activeDashboardTab === 'financeiro' && (
                <div className="space-y-6">
                  {/* Top Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-[#13171D] p-5 rounded-2xl border border-[#1E242B] flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-bold text-[#94A3B8] uppercase">Receita (Entradas)</span>
                        <span className="text-xl font-bold text-emerald-400 mt-1 block">
                          R$ {totalEntradas.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0F3724] text-emerald-400 border border-emerald-500/20">
                        <Plus className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-[#13171D] p-5 rounded-2xl border border-[#1E242B] flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-bold text-[#94A3B8] uppercase">Despesas (Saídas)</span>
                        <span className="text-xl font-bold text-rose-400 mt-1 block">
                          R$ {totalSaidas.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#3D1414] text-rose-400 border border-rose-500/20">
                        <Trash2 className="w-5 h-5 text-rose-400" />
                      </div>
                    </div>

                    <div className="bg-[#12161A] p-5 rounded-2xl border border-[#FACC15]/30 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-bold text-[#FACC15] uppercase">Saldo Em Caixa</span>
                        <span className={`text-xl font-bold mt-1 block ${totalCaixa >= 0 ? 'text-[#F1F5F9]' : 'text-rose-400'}`}>
                          R$ {totalCaixa.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#1E252E] text-[#FACC15] border border-[#FACC15]/20">
                        <DollarSign className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Add Entry Form & List */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-[#13171D] p-5 rounded-2xl border border-[#1E242B]">
                      <h6 className="font-bold text-sm text-[#F1F5F9] mb-4">Lançar Caixa / Contribuição</h6>
                      
                      <form onSubmit={handleAddLancamento} className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Descrição do Lançamento</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Doação velas de sete linhas de Oxalá"
                            value={newLancamento.descricao}
                            onChange={(e) => setNewLancamento({ ...newLancamento, descricao: e.target.value })}
                            className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none placeholder:text-gray-600"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Fluxo</label>
                            <select
                              value={newLancamento.tipo}
                              onChange={(e) => setNewLancamento({ ...newLancamento, tipo: e.target.value as any })}
                              className="w-full text-xs p-2 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                            >
                              <option value="Entrada">Entrada (+)</option>
                              <option value="Saída">Saída (-)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Categoria</label>
                            <select
                              value={newLancamento.categoria}
                              onChange={(e) => setNewLancamento({ ...newLancamento, categoria: e.target.value })}
                              className="w-full text-xs p-2 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                            >
                              <option value="Mensalidade">Mensalidade</option>
                              <option value="Velas">Velas</option>
                              <option value="Festa">Festa / Oferenda</option>
                              <option value="Ervas">Ervas / Banhos</option>
                              <option value="Manutenção">Manutenção</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Valor (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="Ex: 150.00"
                            value={newLancamento.valor}
                            onChange={(e) => setNewLancamento({ ...newLancamento, valor: e.target.value })}
                            className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none placeholder:text-gray-600"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-[#FACC15] hover:bg-[#FDE047] text-[#080A0D] text-xs font-bold py-2.5 rounded-lg transition-all mt-4 text-center inline-block"
                        >
                          Salvar Lançamento
                        </button>
                      </form>
                    </div>

                    {/* Book list */}
                    <div className="lg:col-span-2 space-y-3">
                      <div className="bg-[#13171D] rounded-2xl border border-[#1E242B] overflow-hidden">
                        <table className="min-w-full divide-y divide-[#1E242B]">
                          <thead className="bg-[#12161A]">
                            <tr>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Descrição</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Categoria</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Data</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Fluxo</th>
                              <th className="px-4 py-3 text-right text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Valor</th>
                              <th className="px-4 py-3 text-right"></th>
                            </tr>
                          </thead>
                          <tbody className="bg-[#13171D] divide-y divide-[#1E242B] table-body-ledger animate-fadeIn">
                            {lancamentos.map((l) => (
                              <tr key={l.id} className="hover:bg-[#1E242B]/40 text-xs transition-colors">
                                <td className="px-4 py-3.5 font-medium text-[#F1F5F9]">{l.descricao}</td>
                                <td className="px-4 py-3.5 text-[#94A3B8]">
                                  <span className="bg-[#12161A] px-2 py-0.5 rounded text-[10.5px] border border-[#1E242B]">
                                    {l.categoria}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-[#94A3B8]">{l.data}</td>
                                <td className="px-4 py-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    l.tipo === 'Entrada' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-850' : 'bg-rose-950/60 text-rose-300 border border-rose-850'
                                  }`}>
                                    {l.tipo}
                                  </span>
                                </td>
                                <td className={`px-4 py-3.5 text-right font-bold ${l.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {l.tipo === 'Entrada' ? '+' : '-'} R$ {l.valor.toFixed(2)}
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <button
                                    id={`btn-del-ledger-${l.id}`}
                                    onClick={() => handleDeleteLancamento(l.id, l.descricao)}
                                    className="p-1 text-red-400 hover:text-red-300 hover:bg-white/5 rounded"
                                    title="Remover transação"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: GIRAS SCHEDULER */}
              {activeDashboardTab === 'giras' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-display font-bold text-lg text-[#F1F5F9]">Calendário de Trabalhos Espirituais</h5>
                      <p className="text-xs text-[#94A3B8]">Próximos trabalhos espirituais de caridade, limpeza e festas dos Orixás.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add Gira Form */}
                    <div className="bg-[#13171D] p-5 rounded-2xl border border-[#1E242B]">
                      <h6 className="font-bold text-sm text-[#F1F5F9] mb-4">Adicionar Sessão Litúrgica</h6>
                      
                      <form onSubmit={handleAddGira} className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Nome da Gira / Festividade</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Gira Caboclos Penacho"
                            value={newGira.nome}
                            onChange={(e) => setNewGira({ ...newGira, nome: e.target.value })}
                            className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none placeholder:text-gray-600"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Linha de Trabalho / Foco</label>
                          <select
                            value={newGira.tipo}
                            onChange={(e) => setNewGira({ ...newGira, tipo: e.target.value })}
                            className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                          >
                            <option value="Normal">Normal (Passe e Consulta)</option>
                            <option value="Caridade">Campanha de Caridade</option>
                            <option value="Festa Pública">Homenagem / Festa Ritualística</option>
                            <option value="Fechada">Trabalho Interno / Limpeza</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Data da Sessão</label>
                            <input
                              type="date"
                              required
                              value={newGira.data}
                              onChange={(e) => setNewGira({ ...newGira, data: e.target.value })}
                              className="w-full text-xs p-1.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Horário</label>
                            <input
                              type="text"
                              value={newGira.horario}
                              onChange={(e) => setNewGira({ ...newGira, horario: e.target.value })}
                              className="w-full text-xs p-2 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none placeholder:text-gray-600"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Categoria de Entrada</label>
                          <select
                            value={newGira.status}
                            onChange={(e) => setNewGira({ ...newGira, status: e.target.value as any })}
                            className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                          >
                            <option value="Confirmada">Padrão / Portas Abertas</option>
                            <option value="Especial">Especial (Obrigação do Centro)</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-[#FACC15] hover:bg-[#FDE047] text-[#080A0D] text-xs font-bold py-2.5 rounded-lg transition-all mt-4 text-center inline-block"
                        >
                          Marcar Gira na Nuvem
                        </button>
                      </form>
                    </div>

                    {/* Giras Calendar Cards */}
                    <div className="lg:col-span-2 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                        {giras.map((g) => (
                          <div key={g.id} className="bg-[#13171D] p-4.5 rounded-2xl border border-[#1E242B] flex flex-col justify-between hover:border-[#FACC15]/30 transition-all shadow-md">
                            <div className="flex items-start justify-between gap-1.5">
                              <div>
                                <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                  g.status === 'Especial' ? 'bg-[#9F5234]/20 text-rose-300 border border-[#9F5234]/30' : 'bg-[#2E5A44]/20 text-emerald-300 border border-[#2E5A44]/30'
                                }`}>
                                  {g.tipo}
                                </span>
                                <h6 className="font-bold text-sm text-[#F1F5F9] mt-2">{g.nome}</h6>
                              </div>
                                <button
                                  onClick={() => handleDeleteGira(g.id, g.nome)}
                                  className="text-[#94A3B8] hover:text-red-400 p-1 rounded-lg transition-colors"
                                  title="Desmarcar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="mt-4 pt-3.5 border-t border-[#1E242B] flex items-center justify-between text-xs text-[#94A3B8]">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                                <span className="font-semibold">{g.data.split('-').reverse().join('/')}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-gray-500" />
                                <span>{g.horario}h</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-[#12161A] p-4 rounded-xl border border-[#1E242B] flex items-start gap-3">
                        <div className="p-2 bg-[#13171D] rounded-lg border border-[#1E242B] text-[#FACC15]">
                          <Sparkles className="w-5 h-5 animate-spin duration-[10s]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#F1F5F9]">Oração de Fechamento Integrada</p>
                          <p className="text-[11px] text-[#94A3B8] mt-0.5">O sistema envia um lembrete inteligente no WhatsApp oficial do terreiro 3 horas antes da abertura das portas para a assistência do público geral.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notice Mural Manager Section inside Giras for Zelador */}
                  <div className="pt-8 border-t border-[#1E242B] mt-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                      <div>
                        <h5 className="font-display font-black text-sm text-[#FACC15] uppercase tracking-wider flex items-center gap-2 leading-none">
                          <FileText className="w-4 h-4 text-[#FACC15]" />
                          Mural de Comunicados para Filhos de Santo
                        </h5>
                        <p className="text-xs text-[#94A3B8] mt-1">Publique avisos e preceitos litúrgicos que aparecem instantaneamente no portal dos membros.</p>
                      </div>
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/10 rounded px-2.5 py-1 font-bold">Instantanâeo</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Form Card */}
                      <div className="bg-[#13171D] p-5 rounded-2xl border border-dashed border-[#1E242B] flex flex-col justify-between">
                        <div>
                          <h6 className="font-bold text-xs text-[#F1F5F9] uppercase tracking-wider mb-4 border-b border-[#1E242B] pb-2">Postar Novo Comunicado</h6>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[9px] font-bold text-[#94A3B8] uppercase mb-1">Título do Comunicado</label>
                              <input
                                type="text"
                                placeholder="Ex: Resguardo para Próxima Gira"
                                value={newComunicado.titulo}
                                onChange={(e) => setNewComunicado({ ...newComunicado, titulo: e.target.value })}
                                className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#0D0F12] text-white focus:outline-none focus:border-[#FACC15] placeholder:text-gray-650"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-[#94A3B8] uppercase mb-1">Categoria</label>
                              <select
                                value={newComunicado.categoria}
                                onChange={(e) => setNewComunicado({ ...newComunicado, categoria: e.target.value })}
                                className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#0D0F12] text-white focus:outline-none"
                              >
                                <option value="Geral">🌿 Geral</option>
                                <option value="Preceito">⚠️ Preceito Litúrgico</option>
                                <option value="Financeiro">💰 Contribuição / Tesouraria</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-[#94A3B8] uppercase mb-1">Instruções ou Avisos litúrgicos</label>
                              <textarea
                                rows={2}
                                placeholder="Digite as instruções e avisos litúrgicos..."
                                value={newComunicado.texto}
                                onChange={(e) => setNewComunicado({ ...newComunicado, texto: e.target.value })}
                                className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#0D0F12] text-white focus:outline-none focus:border-[#FACC15] resize-none placeholder:text-gray-650"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (!newComunicado.titulo.trim() || !newComunicado.texto.trim()) {
                              showNotification('Por favor, preencha o título e o texto do comunicado.', 'error');
                              return;
                            }
                            const saved = {
                              id: 'com-' + Date.now().toString(),
                              data: new Date().toISOString().split('T')[0],
                              titulo: newComunicado.titulo,
                              categoria: newComunicado.categoria,
                              texto: newComunicado.texto,
                              autor: profileName || 'Pai Alexandre'
                            };
                            setComunicados([saved, ...comunicados]);
                            setNewComunicado({ titulo: '', categoria: 'Geral', texto: '' });
                            showNotification('Comunicado publicado com sucesso no Mural! Mude para Filho de Santo para visualizar.', 'success');
                          }}
                          className="w-full bg-[#FACC15] hover:bg-yellow-400 text-black text-xs font-black py-2.5 rounded-lg transition-all mt-4 text-center cursor-pointer"
                        >
                          Transmitir para Corrente
                        </button>
                      </div>

                      {/* Warnings Cards Feed */}
                      <div className="lg:col-span-2 space-y-3">
                        {comunicados.length === 0 ? (
                          <div className="p-8 text-center text-xs text-gray-500 bg-[#13171D] rounded-2xl border border-[#1E242B] flex flex-col items-center justify-center gap-2 h-full">
                            <FileText className="w-8 h-8 text-gray-600 animate-pulse" />
                            <span>Nenhum comunicado ativo no mural. Escreva um novo aviso ao lado.</span>
                          </div>
                        ) : (
                          comunicados.map((c) => (
                            <div key={c.id} className="bg-[#13171D] p-4.5 rounded-2xl border border-[#1E242B] hover:border-[#FACC15]/20 transition-all shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                                      c.categoria === 'Preceito' ? 'bg-red-950/40 text-rose-300 border border-red-900/30' :
                                      c.categoria === 'Financeiro' ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/30' :
                                      'bg-blue-950/40 text-blue-300 border border-blue-900/30'
                                    }`}>
                                      {c.categoria}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-mono">{c.data.split('-').reverse().join('/')}</span>
                                  </div>
                                  <h6 className="text-[12.5px] font-black text-[#F1F5F9]">{c.titulo}</h6>
                                  <p className="text-[11.5px] text-gray-400 font-light leading-relaxed mt-1.5">{c.texto}</p>
                                </div>
                                <button
                                  onClick={() => {
                                    setComunicados(comunicados.filter(item => item.id !== c.id));
                                    showNotification('Comunicado excluído do Mural.', 'info');
                                  }}
                                  className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer"
                                  title="Remover do mural"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SACRED POINTS PLAYER (CURIMBA DO TERREIRO) */}
              {activeDashboardTab === 'pontos' && (
                <div className="space-y-6">
                  <div>
                    <h5 className="font-display font-bold text-lg text-[#F1F5F9]">Biblioteca de Pontos Cantados & Riscados</h5>
                    <p className="text-xs text-[#94A3B8]">O maior guardião digital da música sagrada do seu Templo.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Choose catalog */}
                    <div className="lg:col-span-5 space-y-2">
                      <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest px-1">Músicas Cadastradas</p>
                      
                      <div className="space-y-1.5">
                        {pontosList.map((p, idx) => (
                          <div
                            key={p.id}
                            onClick={() => selectPonto(idx)}
                            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                              currentPontoIdx === idx 
                                ? 'bg-[#1E2530] text-[#F1F5F9] border-[#FACC15]/50' 
                                : 'bg-[#13171D] text-[#F1F5F9] border-[#1E242B] hover:bg-[#1E242B]/80'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                                currentPontoIdx === idx ? 'bg-[#FACC15] text-[#080A0D]' : 'bg-[#12161A] text-[#FACC15] border border-[#1E242B]'
                              }`}>
                                {currentPontoIdx === idx && isPlaying ? (
                                  <div className="flex items-end gap-[2px] h-3 w-3">
                                    <div className="w-[2px] h-2 bg-[#080A0D] animate-bounce delay-75"></div>
                                    <div className="w-[2px] h-3 bg-[#080A0D] animate-bounce"></div>
                                    <div className="w-[2px] h-1 bg-[#080A0D] animate-bounce delay-150"></div>
                                  </div>
                                ) : (
                                  <span>0{idx+1}</span>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-xs">{p.titulo}</p>
                                <p className="text-[10px] opacity-70 mt-0.5">{p.linha} • {p.entidade}</p>
                              </div>
                            </div>
                            <Play className={`w-3.5 h-3.5 ${currentPontoIdx === idx ? 'text-[#FACC15]' : 'text-gray-500'}`} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Integrated Simulated Player Screen */}
                    <div className="lg:col-span-7 bg-[#13171D] text-[#F1F5F9] p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-lg border border-[#FACC15]/20">
                      
                      {/* background flame pattern for the player */}
                      <div className="absolute top-1/2 right-10 -translate-y-1/2 text-white/5 pointer-events-none">
                        <Flame className="w-56 h-56 transform rotate-12" />
                      </div>

                      {/* Header player info */}
                      <div className="flex items-center justify-between border-b border-[#1E242B] pb-4 relative z-10">
                        <div>
                          <span className="text-[9px] bg-[#FACC15]/20 text-[#FACC15] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-[#FACC15]/30">
                            Curimba Player • Simulado
                          </span>
                          <h6 className="font-display font-extrabold text-[#F1F5F9] text-base mt-2">
                            {pontosList[currentPontoIdx].titulo}
                          </h6>
                          <p className="text-xs text-[#FACC15] mt-0.5">{pontosList[currentPontoIdx].entidade}</p>
                        </div>
                        
                        {/* Simulated audio bars */}
                        <div className="flex items-end gap-[3px] h-10 w-24">
                          {musicWaveHeight.map((val, i) => (
                            <div
                              key={i}
                              style={{ height: `${val}px` }}
                              className="w-[3px] rounded-full bg-[#FACC15] transition-all duration-300"
                            />
                          ))}
                        </div>
                      </div>

                      {/* Simulated Rolling Lyrics */}
                      <div className="my-6 min-h-[160px] flex flex-col justify-center text-center space-y-2.5 relative z-10 px-4">
                        {pontosList[currentPontoIdx].letra.map((line, lIdx) => {
                          const isCurrent = lIdx === lyricsProgressLine;
                          const isPast = lIdx < lyricsProgressLine;
                          return (
                            <p
                              key={lIdx}
                              className={`text-xs md:text-sm font-medium transition-all duration-500 px-4 py-1 rounded-lg ${
                                isCurrent 
                                  ? 'text-[#F1F5F9] font-bold scale-105 bg-white/10 border border-white/5 shadow-sm' 
                                  : isPast 
                                    ? 'text-gray-500 font-light scale-95' 
                                    : 'text-gray-400 opacity-60'
                              }`}
                            >
                              {line}
                            </p>
                          );
                        })}
                      </div>

                      {/* Simulated controls strip */}
                      <div className="flex items-center justify-between pt-4 border-t border-[#1E242B] relative z-10">
                        <button
                          onClick={() => {
                            setLyricsProgressLine(0);
                            setIsPlaying(!isPlaying);
                            showNotification(isPlaying ? "Simulador Pausado" : "Simulador Ativado");
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs transition-colors border border-white/5"
                        >
                          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-[#FACC15]" />}
                          <span>{isPlaying ? 'Pausar' : 'Iniciar'}</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={nextPonto}
                            className="bg-white/10 hover:bg-white/20 p-2 text-[#FACC15] rounded-xl transition-colors border border-white/10"
                            title="Próxima canção"
                          >
                            <SkipForward className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: PEDIDOS DE REZA E ASSISTÊNCIA ESPIRITUAL */}
              {activeDashboardTab === 'reza' && (
                <div className="space-y-6">
                  {/* Heading row with Perspective Switcher */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1E242B] pb-6">
                    <div>
                      <h5 className="font-display font-bold text-lg text-[#F1F5F9]">Atendimento Espiritual & Pedidos de Reza</h5>
                      <p className="text-xs text-[#94A3B8]">Conectando fiéis e zeladores para amparo espiritual em tempo real.</p>
                    </div>

                    {/* Perspective Switcher */}
                    <div className="flex bg-[#12161A] p-1 rounded-xl border border-[#1E242B] self-start lg:self-auto">
                      <button
                        onClick={() => setActivePerspective('visitante')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          activePerspective === 'visitante'
                            ? 'bg-[#FACC15] text-[#080A0D]'
                            : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                        }`}
                      >
                        Visualização do Visitante (Fiel)
                      </button>
                      <button
                        onClick={() => setActivePerspective('zelador')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          activePerspective === 'zelador'
                            ? 'bg-[#FACC15] text-[#080A0D]'
                            : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                        }`}
                      >
                        Visualização do Zelador (Painel Admin)
                      </button>
                    </div>
                  </div>

                  {/* PERSPECTIVE 1: VISITANTE/FIEL FORM PANEL */}
                  {activePerspective === 'visitante' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
                      
                      {/* Help Column */}
                      <div className="lg:col-span-4 space-y-6">
                        <div className="bg-[#13171D] p-5 rounded-2xl border border-[#1E242B] relative overflow-hidden">
                          <div className="absolute -top-10 -right-10 w-24 h-24 bg-rose-500/5 rounded-full blur-xl" />
                          <div className="w-10 h-10 rounded-xl bg-[#1E2530] flex items-center justify-center text-[#FACC15] mb-4 border border-[#1E242B]">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <h6 className="font-display font-bold text-sm text-[#F1F5F9] mb-2">Amparo e Caridade Litúrgica</h6>
                          <p className="text-xs text-[#94A3B8] leading-relaxed mb-4">
                            A caridade espiritual é o alicerce dos nossos terreiros. Através do Axé Cloud, criamos uma ponte segura contra as intempéries e preconceitos do mundo externo.
                          </p>
                          <div className="space-y-3">
                            <div className="flex gap-2.5">
                              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-[#F1F5F9]">Privacidade garantida (em conformidade com a LGPD)</span>
                            </div>
                            <div className="flex gap-2.5">
                              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-[#F1F5F9]">Direcionado diretamente ao congá da casa de escolha</span>
                            </div>
                            <div className="flex gap-2.5">
                              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-[#F1F5F9]">Firmezas e orações acompanhadas por chat pastoral</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#12161A] p-5 rounded-2xl border border-dashed border-[#1E242B] text-center">
                          <p className="text-xs text-[#94A3B8]">💡 <strong>Quer testar como o Zelador vê?</strong></p>
                          <p className="text-[11px] text-[#94A3B8] mt-1">Preencha o formulário ao lado com suas intenções, envie-o e selecione "Visualização do Zelador" no seletor do topo para aceitar o pedido e enviar orientações!</p>
                        </div>
                      </div>

                      {/* Input Form Column */}
                      <div className="lg:col-span-8 bg-[#13171D] p-6 rounded-3xl border border-[#1E242B] shadow-inner">
                        <h6 className="font-display font-bold text-sm text-[#F1F5F9] mb-4">Formulário de Solicitação de Reza</h6>
                        
                        <form onSubmit={handleAddPrayerRequest} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Selecione o Terreiro / Casa</label>
                              <select
                                value={newPrayerRequest.casa}
                                onChange={(e) => setNewPrayerRequest({...newPrayerRequest, casa: e.target.value})}
                                className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                              >
                                <option value="Terreiro Caboclo Ventania">Terreiro Caboclo Ventania (Esta casa)</option>
                                <option value="Centro Espiritual Luz de Aruanda">Centro Espiritual Luz de Aruanda</option>
                                <option value="Templo da Estrela D'Alva">Templo da Estrela D'Alva</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Seu Nome / Nome para Firmeza</label>
                              <input
                                type="text"
                                placeholder="Nome de quem necessita das preces"
                                value={newPrayerRequest.solicitante}
                                onChange={(e) => setNewPrayerRequest({...newPrayerRequest, solicitante: e.target.value})}
                                className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none placeholder:text-gray-600"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Categoria da Intenção</label>
                              <select
                                value={newPrayerRequest.categoria}
                                onChange={(e) => setNewPrayerRequest({...newPrayerRequest, categoria: e.target.value})}
                                className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                              >
                                <option value="Proteção / Defesa Espiritual">Proteção / Defesa Espiritual</option>
                                <option value="Saúde / Restabelecimento">Saúde / Restabelecimento</option>
                                <option value="Abertura de Caminhos / Prosperidade">Abertura de Caminhos / Prosperidade</option>
                                <option value="Limpeza Espiritual / Descarrego">Limpeza Espiritual / Descarrego</option>
                                <option value="Equilíbrio Emocional / Clamor por Paz">Equilíbrio Emocional / Clamor por Paz</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Trabalho / Orixás Solicitados</label>
                              <select
                                value={newPrayerRequest.linha}
                                onChange={(e) => setNewPrayerRequest({...newPrayerRequest, linha: e.target.value})}
                                className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                              >
                                <option value="Caboclos">Linha dos Caboclos (Cura & Força)</option>
                                <option value="Pretos Velhos / Almas">Linha dos Pretos Velhos (Sabedoria & Tolerância)</option>
                                <option value="Baianos e Boiadeiros">Linha de Baianos e Boiadeiros (Trabalho & Alegria)</option>
                                <option value="Exu / Caminhos">Exus e Pombagiras (Proteção terrena & Caminhos)</option>
                                <option value="Marinheiros / Iemanjá">Linha das Águas (Purificação & Limpeza)</option>
                              </select>
                            </div>
                          </div>

                          {/* Candle Selector */}
                          <div>
                            <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Firmeza Virtual - Vela no Altar</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                              {[
                                { color: 'Branca', desc: 'Paz / Oxalá', bg: 'bg-white text-gray-950 border-gray-400' },
                                { color: 'Vermelha', desc: 'Lei / Ogum', bg: 'bg-red-600 text-white border-red-800' },
                                { color: 'Azul', desc: 'Purificação / Yemanjá', bg: 'bg-blue-600 text-white border-blue-800' },
                                { color: 'Verde', desc: 'Cura / Oxóssi', bg: 'bg-emerald-600 text-white border-emerald-850' },
                                { color: 'Amarela', desc: 'Amor / Oxum', bg: 'bg-yellow-500 text-gray-950 border-yellow-700' },
                                { color: 'Preta', desc: 'Proteção / Exu', bg: 'bg-gray-950 text-white border-gray-900' },
                                { color: 'Nenhuma', desc: 'Apenas preces', bg: 'bg-transparent text-[#94A3B8] border-[#1E242B]' }
                              ].map((v) => {
                                const isSelected = newPrayerRequest.vela === v.color;
                                return (
                                  <button
                                    key={v.color}
                                    type="button"
                                    onClick={() => setNewPrayerRequest({...newPrayerRequest, vela: v.color as any})}
                                    className={`flex flex-col items-center justify-center p-2 rounded-xl text-center border transition-all ${
                                      isSelected 
                                        ? 'border-[#FACC15] ring-1 ring-[#FACC15] bg-[#12161A]' 
                                        : 'border-[#1E242B] bg-[#12161A]/40 hover:bg-[#12161A]'
                                    }`}
                                  >
                                    <span className={`w-3.5 h-3.5 rounded-full ${v.bg} border flex items-center justify-center shadow`}>
                                      {isSelected && <Check className="w-2.5 h-2.5" />}
                                    </span>
                                    <span className="text-[10px] font-bold text-[#F1F5F9] mt-1.5">{v.color}</span>
                                    <span className="text-[8px] text-[#94A3B8] mt-0.5">{v.desc}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Prayer Intention Text */}
                          <div>
                            <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Intenção / Motivo do Pedido</label>
                            <textarea
                              rows={3}
                              placeholder="Explique as aflições ou dificuldades enfrentadas para as quais clama por esta prece/oração..."
                              value={newPrayerRequest.intencao}
                              onChange={(e) => setNewPrayerRequest({...newPrayerRequest, intencao: e.target.value})}
                              className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none placeholder:text-gray-600 resize-none"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-[#FACC15] hover:bg-[#FDE047] text-[#080A0D] font-bold text-xs py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md"
                          >
                            <Heart className="w-4 h-4 fill-current animate-pulse text-rose-600" />
                            Enviar Pedido de Reza ao Altar da Casa Escolhida
                          </button>
                        </form>
                      </div>

                    </div>
                  )}

                  {/* PERSPECTIVE 2: ADMIN ZELADOR PANEL & PASTORAL CHAT */}
                  {activePerspective === 'zelador' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
                      
                      {/* Left Column: Requests List */}
                      <div className="lg:col-span-5 bg-[#13171D] rounded-2xl border border-[#1E242B] overflow-hidden flex flex-col max-h-[620px] shadow-sm">
                        <div className="p-4 border-b border-[#1E242B] bg-[#12161A] flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                            <h6 className="font-display font-black text-xs text-[#F1F5F9] uppercase tracking-wider">Terminal da Zeladoria</h6>
                          </div>
                          <span className="text-[10px] bg-[#1E2530] text-amber-400 font-bold px-2 py-0.5 rounded border border-[#1E242B]">
                            {prayerRequests.filter(r => r.status === 'Pendente').length} Pendentes
                          </span>
                        </div>

                        <div className="p-3 bg-[#12161A]/50 border-b border-[#1E242B] flex gap-1.5">
                          <span className="text-[9px] uppercase font-bold text-[#94A3B8] px-2 py-1 bg-[#1E252E] rounded border border-[#1E242B]">Pedidos Ativos</span>
                        </div>

                        {/* List content */}
                        <div className="overflow-y-auto p-2 space-y-2 flex-grow max-h-[500px]">
                          {prayerRequests.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-xs">
                              Nenhum pedido de amparo encontrado.
                            </div>
                          ) : (
                            prayerRequests.map((req) => {
                              const isSelected = req.id === selectedPrayerId;
                              const candleColorMap: Record<string, string> = {
                                Branca: 'bg-white border-gray-400',
                                Vermelha: 'bg-red-600 border-red-800',
                                Azul: 'bg-blue-600 border-blue-800',
                                Verde: 'bg-emerald-600 border-emerald-800',
                                Amarela: 'bg-yellow-500 border-yellow-700',
                                Preta: 'bg-gray-950 border-gray-900',
                                Nenhuma: 'bg-gray-400 border-[#1E242B]'
                              };
                              
                              return (
                                <div
                                  key={req.id}
                                  onClick={() => {
                                    setSelectedPrayerId(req.id);
                                  }}
                                  className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                                    isSelected 
                                      ? 'bg-[#1E2530] border-[#FACC15]/40 shadow' 
                                      : 'bg-[#12161A] border-[#1E242B] hover:bg-[#1E2530]/50'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                    <div>
                                      <p className="font-bold text-xs text-[#F1F5F9]">{req.solicitante}</p>
                                      <p className="text-[10px] text-[#94A3B8] mt-0.5">{req.casa}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="text-[8px] font-sans text-gray-500">{req.data.split(' ')[1] || req.data}</span>
                                      {req.status === 'Pendente' ? (
                                        <span className="text-[8px] font-bold uppercase tracking-wider bg-amber-500/10 text-[#FACC15] px-1.5 py-0.5 rounded border border-amber-500/20 animate-pulse">Pendente</span>
                                      ) : req.status === 'Em Oração' ? (
                                        <span className="text-[8px] font-bold uppercase tracking-wider bg-violet-600/20 text-violet-400 px-1.5 py-0.5 rounded border border-violet-500/20">Em Prece</span>
                                      ) : (
                                        <span className="text-[8px] font-bold uppercase tracking-wider bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">Aceito</span>
                                      )}
                                    </div>
                                  </div>

                                  <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed mb-2 italic">
                                    "{req.intencao}"
                                  </p>

                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[8.5px] font-semibold text-[#94A3B8] uppercase bg-[#12161A]/60 px-1.5 py-0.5 rounded border border-[#1E242B]">
                                      {req.categoria}
                                    </span>
                                    <span className="text-[8.5px] font-semibold text-[#94A3B8] uppercase bg-[#12161A]/60 px-1.5 py-0.5 rounded border border-[#1E242B]">
                                      {req.linha}
                                    </span>
                                    <div className="flex items-center gap-1 text-[8.5px] ml-auto text-gray-500 font-medium">
                                      <span className={`w-2 h-2 rounded-full ${candleColorMap[req.vela] || 'bg-white'} border`} />
                                      <span>{req.vela !== 'Nenhuma' ? `Vela ${req.vela}` : 'Sem vela'}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Right Column: Dynamic Detail, Candle Firmeza SVG & Chat System */}
                      <div className="lg:col-span-7 bg-[#13171D] rounded-2xl border border-[#1E242B] p-5 flex flex-col justify-between max-h-[620px] shadow-lg">
                        {(() => {
                          const currentReq = prayerRequests.find(r => r.id === selectedPrayerId);
                          if (!currentReq) {
                            return (
                              <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-3">
                                <Heart className="w-10 h-10 text-gray-600 animate-pulse" />
                                <h6 className="font-display font-bold text-xs text-[#F1F5F9] uppercase">Nenhum pedido selecionado</h6>
                                <p className="text-[11px] text-[#94A3B8]">Selecione um pedido ao lado para gerenciar, acender a vela espiritual ou conversar com o solicitante.</p>
                              </div>
                            );
                          }

                          const candleColorHexMap: Record<string, string> = {
                            Branca: '#FFFFFF',
                            Vermelha: '#EF4444',
                            Azul: '#3B82F6',
                            Verde: '#10B981',
                            Amarela: '#F59E0B',
                            Preta: '#27272A',
                            Nenhuma: '#6B7280'
                          };

                          const candleColorNameMap: Record<string, string> = {
                            Branca: 'Branca (Paz / Oxalá)',
                            Vermelha: 'Vermelha (Lei / Ogum)',
                            Azul: 'Azul (Mar / Yemanjá)',
                            Verde: 'Verde (Saúde / Oxóssi)',
                            Amarela: 'Amarela (Amor / Oxum)',
                            Preta: 'Preta (Defesa / Exu)',
                            Nenhuma: 'Apenas preces'
                          };

                          return (
                            <div className="flex flex-col h-full justify-between gap-4">
                              
                              {/* Header Information Pane */}
                              <div className="p-3.5 bg-[#12161A] rounded-xl border border-[#1E242B]">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <span className="text-[9px] bg-[#FACC15]/20 text-[#FACC15] px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-[#FACC15]/30">
                                      {currentReq.categoria}
                                    </span>
                                    <p className="font-display font-black text-sm text-[#F1F5F9] mt-1">{currentReq.solicitante}</p>
                                  </div>
                                  
                                  <button 
                                    onClick={() => {
                                      setPrayerRequests(prayerRequests.filter(r => r.id !== currentReq.id));
                                      showNotification(`Pedido de ${currentReq.solicitante} arquivado e removido do painel.`, 'info');
                                    }}
                                    className="p-1 px-2.5 rounded-lg bg-[#1E252E] hover:bg-rose-950/40 border border-[#1E242B] text-gray-500 hover:text-red-400 transition-colors text-[10px]"
                                    title="Excluir / Arquivar Pedido"
                                  >
                                    Arquivar
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-[10px] text-gray-500 border-t border-[#1E242B] pt-2 mt-2">
                                  <div>
                                    <span className="block font-medium">CASA SOLICITADA</span>
                                    <span className="text-[#F1F5F9] font-semibold">{currentReq.casa}</span>
                                  </div>
                                  <div>
                                    <span className="block font-medium">LINHA RELIGIOSA</span>
                                    <span className="text-[#F1F5F9] font-semibold">{currentReq.linha}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Simulated Candle and Action Center Split */}
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-[#12161A]/40 p-4 rounded-xl border border-[#1E242B]">
                                
                                {/* Candle Fire SVG Visual Display */}
                                <div className="md:col-span-5 flex flex-col items-center justify-center p-2.5 bg-[#12161A] rounded-lg border border-[#1E242B] h-32 relative overflow-hidden">
                                  <div className="absolute top-1.5 right-2 flex gap-1 items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[7.5px] font-bold text-[#94A3B8] uppercase">Congá Digital</span>
                                  </div>

                                  {currentReq.vela !== 'Nenhuma' ? (
                                    <div className="flex flex-col items-center">
                                      {/* Interactive Candle burning state */}
                                      {currentReq.status !== 'Pendente' ? (
                                        <div className="relative mb-1">
                                          {/* Flame SVG */}
                                          <svg className="w-6 h-8 text-[#FACC15] animate-bounce" viewBox="0 0 20 30" fill="currentColor">
                                            <path d="M10 0C6 8 4 14 4 19C4 25.1 8 30 10 30C12 30 16 25.1 16 19C15.9 14 14 8 10 0Z" className="text-amber-500 animate-pulse" />
                                            <path d="M10 6C8 11.3 7 15.3 7 18.7C7 22.8 9.7 26 10 26C10.3 26 13 22.8 13 18.7C13 15.3 12 11.3 10 6Z" className="text-yellow-300" />
                                          </svg>
                                          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-orange-500 rounded-full blur-md opacity-60 animate-ping" />
                                        </div>
                                      ) : (
                                        <div className="h-8 flex items-center justify-center text-[10px] font-bold text-gray-600 uppercase italic tracking-wider mb-1">Apagada</div>
                                      )}
                                      
                                      {/* Candle Body */}
                                      <div 
                                        className="w-5 h-12 rounded-sm shadow-md transition-all border border-black/10 relative"
                                        style={{ backgroundColor: candleColorHexMap[currentReq.vela] || '#FFFFFF' }}
                                      >
                                        {/* Wax drip */}
                                        <div className="absolute top-1 left-0 w-full h-0.5 opacity-60 bg-black/10" />
                                        <div className="absolute top-1.5 left-1.5 w-1 h-3 rounded bg-black/10" />
                                      </div>
                                      <span className="text-[8px] font-bold text-[#94A3B8] mt-1.5 uppercase">Vela {currentReq.vela}</span>
                                    </div>
                                  ) : (
                                    <div className="text-center">
                                      <Heart className="w-6 h-6 text-gray-500 mx-auto mb-1 opacity-50" />
                                      <span className="text-[8px] font-bold text-gray-500 block uppercase">Apenas Corrente de Preces</span>
                                    </div>
                                  )}
                                </div>

                                {/* Actions / Status Controls for the Zelador */}
                                <div className="md:col-span-7 space-y-2.5">
                                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Ações do Altar & Aceite</p>
                                  
                                  {currentReq.status === 'Pendente' ? (
                                    <div className="space-y-2">
                                      <p className="text-[10px] text-[#94A3B8] leading-tight">Zelador avalia o pedido e firma a vela mental do solicitante em nosso congá de caridade.</p>
                                      <button
                                        onClick={() => handleUpdatePrayerStatus(currentReq.id, 'Aceito')}
                                        className="w-full bg-[#FACC15] hover:bg-[#FDE047] text-[#080A0D] text-[10.5px] font-extrabold p-2 rounded-lg flex items-center justify-center gap-1.5 shadow"
                                      >
                                        <Flame className="w-3.5 h-3.5 fill-current text-orange-600 animate-pulse" />
                                        Aceitar e Firmar Altar
                                      </button>
                                    </div>
                                  ) : currentReq.status === 'Aceito' ? (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Pedido aceito, vela de {currentReq.vela} ativada!</span>
                                      </div>
                                      <p className="text-[10px] text-[#94A3B8] leading-tight">Inicie uma corrente sintonizada de vibrações de caridade agora para este irmão em aflição.</p>
                                      <button
                                        onClick={() => handleUpdatePrayerStatus(currentReq.id, 'Em Oração')}
                                        className="w-full bg-violet-600 hover:bg-violet-700 text-white text-[10.5px] font-extrabold p-2 rounded-lg flex items-center justify-center gap-1.5"
                                      >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        Começar Vibração Espiritual Ativa
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <div className="p-2 border border-violet-950 bg-violet-950/20 rounded text-center">
                                        <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest flex items-center justify-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
                                          Em Oração Ativa na Casa
                                        </span>
                                        <span className="text-[9px] text-[#94A3B8] block mt-0.5">Sua casa está ativamente emanando bençãos.</span>
                                      </div>
                                      <button
                                        onClick={() => {
                                          setPrayerRequests(prevRequests => prevRequests.map(r => r.id === currentReq.id ? { ...r, status: 'Aceito' } : r));
                                          showNotification("Sessão finalizada. Pedido mantido como confirmado.", "info");
                                        }}
                                        className="w-full bg-[#1E2530] hover:bg-white/5 border border-[#1E242B] text-[#94A3B8] text-[9.5px] p-2 rounded-lg font-bold"
                                      >
                                        Finalizar Sessão de Oração
                                      </button>
                                    </div>
                                  )}
                                </div>

                              </div>

                              {/* PASTORAL CHAT CONVERSATION FOR INTERACTION */}
                              <div className="flex flex-col flex-grow min-h-[190px] max-h-[250px] border border-[#1E242B] rounded-xl overflow-hidden bg-[#12161A]/60">
                                <div className="p-2 bg-[#12161A] text-[9.5px] font-bold text-[#94A3B8] uppercase border-b border-[#1E242B] flex items-center justify-between">
                                  <span>Chat Pastoral e Conselhos Litúrgicos</span>
                                  <span className="text-[8px] bg-red-950/40 text-rose-400 font-normal px-1 rounded">Canal Privado</span>
                                </div>

                                {/* Bubble Stream Area */}
                                <div className="flex-grow overflow-y-auto p-3 space-y-2 flex flex-col justify-end">
                                  {currentReq.chatMessages.map((msg) => {
                                    const isZelador = msg.sender === 'Zelador';
                                    const isSystem = msg.id.startsWith('m-sys-');
                                    
                                    if (isSystem) {
                                      return (
                                        <div key={msg.id} className="text-center my-1.5">
                                          <span className="text-[8.5px] bg-[#1E2530] text-[#FACC15] px-2 py-0.5 rounded-full border border-[#1E242B]">
                                            {msg.text}
                                          </span>
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <div
                                        key={msg.id}
                                        className={`flex flex-col max-w-[85%] ${
                                          isZelador ? 'align-end self-end items-end' : 'align-start self-start items-start'
                                        }`}
                                      >
                                        <span className="text-[8px] text-gray-500 mb-0.5">
                                          {isZelador ? `Zelador (${profileName})` : `${currentReq.solicitante} (Fiel)`} • {msg.time}
                                        </span>
                                        <div
                                          className={`p-2.5 rounded-xl text-[11px] leading-relaxed ${
                                            isZelador
                                              ? 'bg-[#FACC15] text-[#080A0D] rounded-tr-none'
                                              : 'bg-[#1E2530] text-[#F1F5F9] rounded-tl-none border border-[#1E242B]'
                                          }`}
                                        >
                                          {msg.text}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Chat Input Field */}
                                <div className="p-2 border-t border-[#1E242B] bg-[#12161A] flex gap-1.5 items-center">
                                  <input
                                    type="text"
                                    placeholder={
                                      activePerspective === 'zelador'
                                        ? "Diga uma orientação pastoral, banho de ervas ou mensagem ao fiel..."
                                        : "Envie uma mensagem ao altar..."
                                    }
                                    value={chatInputText}
                                    onChange={(e) => setChatInputText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSendChatMessage(activePerspective === 'zelador' ? 'Zelador' : 'Visitante');
                                    }}
                                    className="flex-grow text-xs px-2.5 py-1.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none placeholder:text-gray-600"
                                  />
                                  
                                  <button
                                    onClick={() => handleSendChatMessage(activePerspective === 'zelador' ? 'Zelador' : 'Visitante')}
                                    className="bg-[#FACC15] hover:bg-[#FDE047] text-[#080A0D] px-3 py-1.5 text-xs font-bold rounded-lg transition-all"
                                  >
                                    Enviar
                                  </button>
                                </div>
                              </div>

                              {/* Instant Presets/Templates for testing quick chats */}
                              <div className="flex flex-wrap gap-1.5 items-center bg-[#12161A]/20 p-2 border border-[#1E242B] rounded-xl text-[9px] text-[#94A3B8]">
                                <span className="font-bold uppercase tracking-wider text-gray-500 mr-1 flex items-center gap-0.5">
                                  <Leaf className="w-3 h-3 text-emerald-400" /> Rezário / Conselhos Rápidos:
                                </span>
                                {[
                                  { text: 'Sua vela está firmada em nosso congá de paz e luz. Confie!', label: '🕯️ Confirmar Vela' },
                                  { text: 'Para acalmar do cansaço, tome um banho de ervas frias (Alecrim e Alfazema) antes de dormir.', label: '🌿 Banho de Ervas' },
                                  { text: 'Que Oxalá cubra você e os seus de absoluta proteção e amor.', label: '✨ Benção Oxalá' }
                                ].map((t, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setChatInputText(t.text);
                                      showNotification('Carregado no campo de chat abaixo.');
                                    }}
                                    className="bg-[#1E252E] hover:bg-[#1E2530] border border-[#1E242B] px-1.5 py-1 rounded text-[#F1F5F9] font-medium transition-colors"
                                  >
                                    {t.label}
                                  </button>
                                ))}
                              </div>

                            </div>
                          );
                        })()}
                      </div>

                    </div>
                  )}
                </div>
              )}

              {activeDashboardTab === 'whatsapp' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Top Header Row of the Tab */}
                  <div className="border-b border-[#1E242B] pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h5 className="font-display font-bold text-lg text-[#F1F5F9] flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-[#10B981]" />
                        Integração & Configuração do WhatsApp
                      </h5>
                      <p className="text-xs text-[#94A3B8]">
                        Conecte o seu número para automatizar o envio de notificações, cobranças de mensalidades e avisos de giras para os filhos de santo da corrente.
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md border flex items-center gap-1.5 transition-all ${
                        whatsappConnected 
                          ? 'bg-emerald-950/20 text-[#10B981] border-[#10B981]/20' 
                          : 'bg-[#1E252E] text-[#94A3B8] border-[#1E242B]'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${whatsappConnected ? 'bg-emerald-500 animate-ping' : 'bg-gray-550'}`} />
                        {whatsappConnected ? 'Dispositivo Conectado' : 'Aparelho Desconectado'}
                      </span>
                    </div>
                  </div>

                  {/* Main Grid Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                    
                    {/* LEFT COLUMN: CONNECTION & PREFERENCES */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      {/* Step 1: Device Connection Panel */}
                      <div className="bg-[#13171D] p-5 rounded-2xl border border-[#1E242B] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/5 rounded-full filter blur-xl pointer-events-none" />
                        
                        <h6 className="font-bold text-xs text-[#F1F5F9] uppercase tracking-wider mb-4 flex items-center gap-1.5 text-emerald-400">
                          <Smartphone className="w-4 h-4" />
                          1. Conexão do Celular (Zelador)
                        </h6>

                        {!whatsappConnected ? (
                          <div className="space-y-4">
                            <div className="p-4 bg-[#12161A]/80 rounded-xl border border-[#1E242B] space-y-2.5">
                              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                                Siga as instruções abaixo para vincular o WhatsApp oficial do Terreiro à plataforma Axé Cloud:
                              </p>
                              <ol className="list-decimal list-inside text-xs text-gray-350 space-y-1.5 ml-1 font-light">
                                <li>Abra o WhatsApp no seu smartphone.</li>
                                <li>Vá em <strong className="text-white">Aparelhos Conectados</strong> no menu de configurações.</li>
                                <li>Selecione <strong className="text-[#10B981]">Conectar um aparelho</strong> e aponte para o QR Code.</li>
                              </ol>
                            </div>

                            {/* Connection trigger buttons */}
                            <div className="flex flex-col sm:flex-row items-center gap-3">
                              {!whatsappQR && !whatsappConnecting ? (
                                <button
                                  onClick={() => {
                                    setWhatsappConnecting(true);
                                    setTimeout(() => {
                                      setWhatsappConnecting(false);
                                      setWhatsappQR(true);
                                      showNotification('QR Code de emparelhamento gerado com sucesso!', 'info');
                                    }, 1000);
                                  }}
                                  className="w-full sm:w-auto bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#10B981]/10"
                                >
                                  <QrCode className="w-4 h-4" />
                                  Gerar QR Code de Integração
                                </button>
                              ) : whatsappConnecting ? (
                                <div className="flex items-center gap-3 text-xs text-emerald-400 font-bold bg-emerald-950/20 py-2.5 px-4 rounded-xl border border-emerald-500/10">
                                  <svg className="w-4 h-4 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  Gerando canais criptografados de sincronização...
                                </div>
                              ) : (
                                <div className="w-full bg-[#12161A] p-5 rounded-xl border border-[#1E242B] flex flex-col items-center justify-center space-y-4 animate-fadeIn">
                                  
                                  {/* Dynamic Fake QR Code drawing */}
                                  <div className="p-3 bg-white rounded-lg relative overflow-hidden border-2 border-emerald-500 shadow-lg">
                                    <div className="w-40 h-40 bg-zinc-100 grid grid-cols-4 gap-1 opacity-90 p-1">
                                      {Array.from({ length: 16 }).map((_, i) => (
                                        <div 
                                          key={i} 
                                          className={`rounded-sm ${(i * 7 + 3) % 2 === 0 ? 'bg-zinc-900' : 'bg-transparent'} ${i === 0 || i === 3 || i === 12 ? 'border-4 border-zinc-900 bg-transparent' : ''}`} 
                                        />
                                      ))}
                                    </div>
                                    <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center animate-pulse pointer-events-none">
                                      <QrCode className="w-12 h-12 text-[#10B981]" />
                                    </div>
                                  </div>

                                  <div className="text-center space-y-1">
                                    <span className="text-[8.5px] uppercase tracking-widest font-black text-amber-500 block">Sincronização Ativa</span>
                                    <p className="text-[10px] text-gray-400">QR Code expira em 3 minutos. Escaneie-o abaixo para testar.</p>
                                  </div>

                                  <div className="flex flex-col sm:flex-row gap-2 w-full justify-center">
                                    <button
                                      onClick={() => {
                                        setWhatsappConnecting(true);
                                        setWhatsappQR(false);
                                        setTimeout(() => {
                                          setWhatsappConnecting(false);
                                          setWhatsappConnected(true);
                                          showNotification('WhatsApp conectado com sucesso ao Terreiro!', 'success');
                                        }, 1500);
                                      }}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Simular Escaneamento no Celular
                                    </button>
                                    <button
                                      onClick={() => setWhatsappQR(false)}
                                      className="bg-transparent hover:bg-white/5 text-gray-400 font-bold text-xs py-2 px-4 rounded-lg border border-white/10 transition-colors cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-fadeIn">
                            
                            {/* Connected device mock detail info card */}
                            <div className="p-4 bg-emerald-950/10 rounded-xl border border-emerald-500/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="p-3 bg-emerald-600 rounded-lg text-white">
                                  <Wifi className="w-5 h-5 animate-pulse" />
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[9.5px] uppercase tracking-wide font-black text-emerald-400 block mb-1">Status: Ativo & Operante</span>
                                  <h6 className="text-sm font-bold text-[#F1F5F9]">{whatsappPhone} (Zelador)</h6>
                                  <p className="text-[9.5px] text-gray-400">
                                    Vínculo Webhook API • Signal 100% • Bateria: 94% • Versão Node-WS: 2.34.1
                                  </p>
                                </div>
                              </div>

                              <button
                                onClick={() => {
                                  setWhatsappConnected(false);
                                  setWhatsappQR(false);
                                  showNotification('WhatsApp do Zelador desconectado com sucesso.', 'info');
                                }}
                                className="bg-rose-950/20 text-rose-450 border border-rose-500/20 hover:bg-rose-900/30 font-bold text-xs py-2 px-4 rounded-xl transition-all self-stretch sm:self-auto cursor-pointer"
                              >
                                Desconectar Aparelho
                              </button>
                            </div>

                            {/* WhatsApp profile simulation detail */}
                            <div className="text-xs text-[#94A3B8] p-3 bg-[#12161A] rounded-xl border border-[#1E242B] flex items-center justify-between">
                              <span>Sincronizando com Giras, Financeiro e Altar Virtual em tempo de execução:</span>
                              <span className="text-emerald-400 font-bold flex items-center gap-1 uppercase text-[8px] tracking-wider shrink-0">
                                <Radio className="w-3 h-3 animate-ping shrink-0" /> Webhook Online
                              </span>
                            </div>

                          </div>
                        )}
                      </div>

                      {/* Step 2: Push Notifications Preferences Panel */}
                      <div className="bg-[#13171D] p-5 rounded-2xl border border-[#1E242B]">
                        <h6 className="font-bold text-xs text-[#F1F5F9] uppercase tracking-wider mb-4 flex items-center gap-1.5 text-amber-500">
                          <Settings className="w-4 h-4" />
                          2. Filhos de Santo & Fiel: Preferências de Gatilho
                        </h6>

                        <p className="text-xs text-gray-400 mb-4 font-light leading-relaxed">
                          Escolha quais acontecimentos administrativos ou religiosos gerarão mensagens automáticas enviadas para os respectivos celulares dos filhos de santo ou fiéis:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          
                          {/* Preferência 1: Giras */}
                          <div 
                            onClick={() => {
                              setWhatsappPreferences({ ...whatsappPreferences, notifGiras: !whatsappPreferences.notifGiras });
                              showNotification(`Gatilho de Giras ${!whatsappPreferences.notifGiras ? 'ativador' : 'desativador'}!`);
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                              whatsappPreferences.notifGiras 
                                ? 'bg-[#1E252E] border-emerald-500/30' 
                                : 'bg-[#0F1216] border-[#1E242B] opacity-60'
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              checked={whatsappPreferences.notifGiras}
                              onChange={() => {}} // handled by parent div click
                              className="accent-emerald-500 w-3.5 h-3.5 mt-0.5 rounded cursor-pointer"
                            />
                            <div>
                              <h6 className="text-xs font-bold text-[#F1F5F9]">Notificação de Gira</h6>
                              <p className="text-[10px] text-gray-455 mt-1 leading-snug">
                                Envia convocação litúrgica aos médiuns quando novas giras forem agendadas.
                              </p>
                            </div>
                          </div>

                          {/* Preferência 2: Financeiro */}
                          <div 
                            onClick={() => {
                              setWhatsappPreferences({ ...whatsappPreferences, notifFinanceiro: !whatsappPreferences.notifFinanceiro });
                              showNotification(`Gatilho Financeiro ${!whatsappPreferences.notifFinanceiro ? 'ativador' : 'desativador'}!`);
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                              whatsappPreferences.notifFinanceiro 
                                ? 'bg-[#1E252E] border-emerald-500/30' 
                                : 'bg-[#0F1216] border-[#1E242B] opacity-60'
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              checked={whatsappPreferences.notifFinanceiro}
                              onChange={() => {}} // handled by parent div click
                              className="accent-emerald-500 w-3.5 h-3.5 mt-0.5 rounded cursor-pointer"
                            />
                            <div>
                              <h6 className="text-xs font-bold text-[#F1F5F9]">Comprovantes Financeiros</h6>
                              <p className="text-[10px] text-gray-455 mt-1 leading-snug">
                                Envia lembretes e comprovantes assim que mensalidades dos médiuns forem compensadas.
                              </p>
                            </div>
                          </div>

                          {/* Preferência 3: Altar Virtual Reza */}
                          <div 
                            onClick={() => {
                              setWhatsappPreferences({ ...whatsappPreferences, notifReza: !whatsappPreferences.notifReza });
                              showNotification(`Gatilho do Altar Virtual ${!whatsappPreferences.notifReza ? 'ativador' : 'desativador'}!`);
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                              whatsappPreferences.notifReza 
                                ? 'bg-[#1E252E] border-emerald-500/30' 
                                : 'bg-[#0F1216] border-[#1E242B] opacity-60'
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              checked={whatsappPreferences.notifReza}
                              onChange={() => {}} // handled by parent div click
                              className="accent-emerald-500 w-3.5 h-3.5 mt-0.5 rounded cursor-pointer"
                            />
                            <div>
                              <h6 className="text-xs font-bold text-[#F1F5F9]">Altar Virtual (Pedidos de Reza)</h6>
                              <p className="text-[10px] text-gray-455 mt-1 leading-snug">
                                Envia aviso de firmeza de vela e oração iniciada aos devotos que efetuarem preces.
                              </p>
                            </div>
                          </div>

                          {/* Preferência 4: Aniversários / Escalas */}
                          <div 
                            onClick={() => {
                              setWhatsappPreferences({ ...whatsappPreferences, notifAniversarios: !whatsappPreferences.notifAniversarios });
                              showNotification(`Gatilho de Mensagens de Confraternização ${!whatsappPreferences.notifAniversarios ? 'ativador' : 'desativador'}!`);
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                              whatsappPreferences.notifAniversarios 
                                ? 'bg-[#1E252E] border-emerald-500/30' 
                                : 'bg-[#0F1216] border-[#1E242B] opacity-60'
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              checked={whatsappPreferences.notifAniversarios}
                              onChange={() => {}} // handled by parent div click
                              className="accent-emerald-500 w-3.5 h-3.5 mt-0.5 rounded cursor-pointer"
                            />
                            <div>
                              <h6 className="text-xs font-bold text-[#F1F5F9]">Parabéns & Recados Gerais</h6>
                              <p className="text-[10px] text-gray-455 mt-1 leading-snug">
                                Disparos festivos automáticos aos filhos aniversariantes do dia na corrente de fé.
                              </p>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Step 3: Test Broadcast Message */}
                      <div className="bg-[#13171D] p-5 rounded-2xl border border-[#1E242B]">
                        <h6 className="font-bold text-xs text-[#F1F5F9] uppercase tracking-wider mb-4 flex items-center gap-1.5 text-emerald-400">
                          <Send className="w-4 h-4" />
                          3. Testar Transmissão Direta (Médiuns)
                        </h6>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">
                              Mensagem de Comunicado Geral da Casa
                            </label>
                            <textarea
                              rows={3}
                              value={whatsappTestMessage}
                              onChange={(e) => setWhatsappTestMessage(e.target.value)}
                              placeholder="Redija uma mensagem rápida para testar a comunicação com todos os filhos de santo cadastrados na corrente."
                              className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#10B981] focus:outline-none placeholder:text-gray-550 resize-none leading-relaxed"
                            />
                          </div>

                          <button
                            onClick={() => {
                              if (!whatsappConnected) {
                                showNotification('Não foi possível enviar: WhatsApp desconectado. Conecte no Passo 1 antes de transmitir.', 'error');
                                return;
                              }
                              if (!whatsappTestMessage.trim()) {
                                showNotification('Por favor, digite alguma mensagem para poder testar o disparo.', 'error');
                                return;
                              }
                              triggerWhatsappLog('Corrente Geral (34 médiuns)', whatsappTestMessage, 'teste');
                              setWhatsappTestMessage('');
                              showNotification('Mensagem de teste transmitida com sucesso para toda a corrente!', 'success');
                            }}
                            className={`w-full font-bold text-xs py-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              whatsappConnected 
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/10' 
                                : 'bg-[#12161A] text-gray-500 border border-[#1E242B]/85 cursor-not-allowed hover:bg-[#12161A]'
                            }`}
                          >
                            <Send className="w-3.5 h-3.5" />
                            Disparar Mensagem para a Corrente (Grupo)
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* RIGHT COLUMN: REALTIME MESSAGING FEED / LOGS */}
                    <div className="lg:col-span-5 bg-[#13171D] p-5 rounded-2xl border border-[#1E242B] flex flex-col justify-between">
                      <div className="space-y-5">
                        
                        <div className="flex items-center justify-between border-b border-[#1E242B] pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            <h6 className="font-display font-bold text-sm text-[#F1F5F9]">Painel de Transmissões Recentes</h6>
                          </div>
                          
                          <span className="text-[8px] uppercase tracking-wider font-extrabold px-2 py-0.5 bg-[#12161A] text-[#10B981] border border-emerald-500/20 rounded">
                            Logs Dinâmicos
                          </span>
                        </div>

                        <p className="text-[11px] text-gray-400 font-light">
                          Abaixo você confere o monitoramento das mensagens de transito enviadas pelo webhook do terreiro em tempo de execução:
                        </p>

                        {/* Logs list feed wrapper */}
                        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                          {whatsappLogs.map((log) => {
                            const badgeColorMap = {
                              gira: 'bg-emerald-950/40 text-emerald-400 border-emerald-600/10',
                              financeiro: 'bg-blue-950/40 text-blue-400 border-blue-600/10',
                              reza: 'bg-rose-950/40 text-rose-400 border-rose-600/10',
                              teste: 'bg-amber-950/40 text-[#FACC15] border-amber-600/10'
                            };
                            return (
                              <div key={log.id} className="p-3 bg-[#12161A] rounded-xl border border-[#1E242B] space-y-2 animate-fadeIn hover:bg-[#1E242B]/20 transition-colors">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] font-bold text-white max-w-[124px] truncate">{log.destino}</span>
                                    <span className={`text-[8px] font-bold uppercase py-0.5 px-1.5 rounded border ${badgeColorMap[log.tipo] || ''}`}>
                                      {log.tipo}
                                    </span>
                                  </div>
                                  <span className="text-[8px] text-gray-500 shrink-0 font-mono">{log.data}</span>
                                </div>
                                <p className="text-[10.5px] text-gray-300 leading-relaxed italic bg-black/15 p-2 rounded">
                                  "{log.mensagem}"
                                </p>
                                <div className="flex items-center justify-between pt-1 border-t border-[#1E242B]/80 text-[8.5px]">
                                  <span className="text-gray-500 font-bold">Status Gateway:</span>
                                  <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                    ✓ {log.status}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                      </div>

                      {/* Interactive testing guide details */}
                      <div className="mt-6 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 space-y-1.5 text-[10px] text-gray-400 leading-relaxed">
                        <div className="font-bold text-[#F1F5F9] flex items-center gap-1 mb-1">
                          <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" /> Como testar no Simulador Interativo:
                        </div>
                        <p>
                          Conecte o WhatsApp no <strong>Passo 1</strong> acima. Depois, experimente criar uma nova Gira na aba <strong>Giras</strong>, registrar um lançamento na aba <strong>Financeiro</strong> ou aceitar/rezar por um pedido na aba <strong>Pedidos de Reza</strong>. Você verá os envios automáticos e relatórios de fluxo surgindo neste painel instantaneamente em tempo real!
                        </p>
                      </div>

                    </div>

                  </div>

                </div>
              )}

              {activeDashboardTab === 'configuracoes' && (
                <div className="space-y-6 animate-fadeIn text-[#F1F5F9]">
                  
                  {/* Top Header Row of the Tab */}
                  <div className="border-b border-[#1E242B] pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h5 className="font-display font-bold text-lg text-[#F1F5F9] flex items-center gap-2">
                        <Settings className="w-5 h-5 text-[#3B82F6]" />
                        Configurações da Zeladoria
                      </h5>
                      <p className="text-xs text-[#94A3B8]">
                        Gerencie a identidade de sua casa de Axé, customize sua assinatura litúrgica e de notificações no simulador.
                      </p>
                    </div>
                  </div>

                  {/* Settings submenus list (Left Sidebar) and panel (Right Content) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                    
                    {/* LEFT COLUMN: SETTINGS SUBMENU */}
                    <div className="lg:col-span-3 space-y-2">
                      <p className="text-[10px] font-bold text-gray-405 uppercase tracking-wider px-2 mb-2">Sub-Menus</p>
                      
                      {/* Sub-menu trigger: Perfil (Core Functional) */}
                      <button
                        onClick={() => {
                          setConfigSubTab('perfil');
                          showNotification('Visualizando configurações do Perfil!', 'info');
                        }}
                        className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center gap-2.5 font-bold text-xs ${
                          configSubTab === 'perfil'
                            ? 'bg-[#1E252E] text-white border-l-2 border-l-[#3B82F6] shadow-sm'
                            : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <User className="w-4 h-4 text-[#3B82F6]" />
                        Perfil do Zelador
                      </button>

                      {/* Sub-menu trigger: Religioso (Illustrative) */}
                      <button
                        onClick={() => {
                          setConfigSubTab('religioso');
                          showNotification('Informações do Terreiro carregadas no Painel!', 'info');
                        }}
                        className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center gap-2.5 font-bold text-xs ${
                          configSubTab === 'religioso'
                            ? 'bg-[#1E252E] text-white border-l-2 border-l-[#3B82F6] shadow-sm'
                            : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Globe className="w-4 h-4 text-cyan-400" />
                        Informações do Terreiro
                      </button>

                      {/* Sub-menu trigger: Segurança (Illustrative) */}
                      <button
                        onClick={() => {
                          setConfigSubTab('plataforma');
                          showNotification('Parâmetros de Segurança do Terreiro!', 'info');
                        }}
                        className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center gap-2.5 font-bold text-xs ${
                          configSubTab === 'plataforma'
                            ? 'bg-[#1E252E] text-white border-l-2 border-l-[#3B82F6] shadow-sm'
                            : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Shield className="w-4 h-4 text-emerald-400" />
                        Segurança & API
                      </button>

                      <div className="pt-4 border-t border-[#1E242B] mt-4 px-2">
                        <div className="p-3 bg-[#12161A]/80 rounded-lg border border-[#1E242B] text-center space-y-1">
                          <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider block">Identidade de Fé</span>
                          <p className="text-[9px] text-gray-400 leading-normal">
                            As atualizações feitas aqui mudam as assinaturas e listagens no Altar Virtual, nas mensalidades, no painel administrativo e na corrente geral de médiuns do simulador.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: ACTIVE PANEL CONTENT */}
                    <div className="lg:col-span-9">
                      
                      {/* SUB-MENU CONTENT: PERFIL DE ZELADOR */}
                      {configSubTab === 'perfil' && (
                        <div className="bg-[#13171D] p-5 sm:p-6 rounded-2xl border border-[#1E242B] space-y-6 animate-fadeIn">
                          
                          <div className="flex items-center justify-between border-b border-[#1E242B] pb-3.5">
                            <div>
                              <h6 className="font-display font-bold text-sm text-[#F1F5F9]">Editar Perfil de Zeladoria</h6>
                              <p className="text-[11px] text-gray-405 mt-0.5 font-light">Altere as credenciais e assinaturas que representam o sacerdote principal da casa de caridade.</p>
                            </div>
                            <span className="text-[8px] uppercase tracking-wider px-2 py-0.5 bg-blue-950/20 text-[#3B82F6] border border-[#3B82F6]/20 rounded font-bold shrink-0">
                              Perfil Ativo
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                            
                            {/* Inputs form on the left */}
                            <div className="md:col-span-7 space-y-4">
                              
                              {/* 1. Nome do Zelador */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                                  Nome Litúrgico do Zelador(a)
                                </label>
                                <input
                                  type="text"
                                  value={profileName}
                                  onChange={(e) => setProfileName(e.target.value)}
                                  placeholder="Ex: Pai Alexandre de Ogum"
                                  className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#3B82F6] focus:outline-none"
                                />
                              </div>

                              {/* 2. Nome do Terreiro */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                                  Nome do Terreiro / Templo de Fé
                                </label>
                                <input
                                  type="text"
                                  value={profileTerreiro}
                                  onChange={(e) => setProfileTerreiro(e.target.value)}
                                  placeholder="Ex: Humaitá Luz do Amanhã"
                                  className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#3B82F6] focus:outline-none"
                                />
                              </div>

                              {/* 3. Cargo Sacerdotal */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                                  Cargo Litúrgico / Sacerdotal
                                </label>
                                <select
                                  value={profileCargo}
                                  onChange={(e) => setProfileCargo(e.target.value)}
                                  className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#3B82F6] focus:outline-none accent-blue-500"
                                >
                                  <option value="Zelador de Santo (Pai de Santo)">Zelador de Santo (Pai de Santo)</option>
                                  <option value="Zeladora de Santo (Mãe de Santo)">Zeladora de Santo (Mãe de Santo)</option>
                                  <option value="Babalorixá">Babalorixá</option>
                                  <option value="Ialorixá">Ialorixá</option>
                                  <option value="Babalaô">Babalaô</option>
                                  <option value="Zelador Geral da Corrente">Zelador Geral da Corrente</option>
                                </select>
                              </div>

                              {/* 4. Link da Foto / URL Personalizada */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center justify-between">
                                  <span>URL da Foto de Perfil</span>
                                  <span className="text-[8px] text-amber-500 lowercase">Escolha um link ou use uma predefinição</span>
                                </label>
                                <input
                                  type="text"
                                  value={profileFoto}
                                  onChange={(e) => setProfileFoto(e.target.value)}
                                  placeholder="Insira um link HTTPS de imagem"
                                  className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#3B82F6] focus:outline-none"
                                />
                              </div>

                              {/* Presets Selection Grid */}
                              <div className="space-y-2 pt-1">
                                <span className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Predefinições de Foto Rápidas</span>
                                <div className="grid grid-cols-4 gap-2">
                                  {[
                                    {
                                      name: 'Sacerdote Elder',
                                      url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256',
                                      label: '👴 Sábio'
                                    },
                                    {
                                      name: 'Sacerdotisa Velha',
                                      url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256',
                                      label: '👵 Guia'
                                    },
                                    {
                                      name: 'Luz Estrela',
                                      url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&q=80&w=256',
                                      label: '✨ Congá'
                                    },
                                    {
                                      name: 'Sacerdotisa Jovem',
                                      url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256',
                                      label: '👩 Mãe'
                                    }
                                  ].map((preset, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        setProfileFoto(preset.url);
                                        showNotification(`Foto de perfil "${preset.name}" selecionada!`, 'info');
                                      }}
                                      className={`p-1.5 rounded-lg border text-center transition-all ${
                                        profileFoto === preset.url
                                          ? 'bg-blue-950/40 border-blue-500 text-blue-400 font-extrabold scale-105'
                                          : 'bg-[#12161A] border-[#1E242B] text-gray-400 hover:border-gray-500'
                                      }`}
                                    >
                                      <div className="w-8 h-8 rounded-full overflow-hidden mx-auto mb-1 border border-white/5 bg-zinc-900">
                                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      </div>
                                      <span className="text-[9px] block leading-none">{preset.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Actions confirmation */}
                              <div className="pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!profileName.trim()) {
                                      showNotification('O seu nome litúrgico não pode ficar em branco.', 'error');
                                      return;
                                    }
                                    if (!profileTerreiro.trim()) {
                                      showNotification('O nome do Terreiro é um campo obrigatório.', 'error');
                                      return;
                                    }

                                    // Dynamic synchronization to the Mediums array list:
                                    setMediums(prev => prev.map(m => {
                                      if (m.id === '2') {
                                        return {
                                          ...m,
                                          nome: profileName,
                                          cargo: profileCargo,
                                        };
                                      }
                                      return m;
                                    }));

                                    showNotification('Alterações de Perfil gravadas com sucesso! Nome e Cargo sincronizados nas abas Corrente e chats.', 'success');
                                  }}
                                  className="w-full cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Salvar Configurações do Perfil
                                </button>
                              </div>

                            </div>

                            {/* Badge Preview / Card on the right */}
                            <div className="md:col-span-5 space-y-4">
                              <span className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                                Crachá Sacerdotal Ativo
                              </span>

                              {/* Beautiful visual priestess outline card with animated gradient border */}
                              <div className="relative rounded-2xl p-4 bg-gradient-to-b from-[#1E2530] to-[#12161A] border border-[#1E242B] overflow-hidden text-center shadow-lg group">
                                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600" />
                                
                                <div className="space-y-3.5 relative">
                                  
                                  {/* Avatars container with ring glow */}
                                  <div className="relative w-20 h-20 mx-auto mt-2">
                                    <div className="absolute inset-0 bg-blue-500/20 rounded-full filter blur-md animate-pulse" />
                                    <div className="w-20 h-20 rounded-full border-2 border-[#3B82F6] overflow-hidden bg-[#12161A] relative z-10 mx-auto shadow-inner">
                                      <img
                                        src={profileFoto || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2'}
                                        alt={profileName}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256';
                                        }}
                                      />
                                    </div>
                                    <span className="absolute bottom-0 right-1 w-4 h-4 bg-emerald-500 border-2 border-[#1E252E] rounded-full z-20" />
                                  </div>

                                  <div>
                                    <h6 className="font-display font-black text-sm text-[#F1F5F9] max-w-full truncate">{profileName || 'Seu Nome de Fé'}</h6>
                                    <p className="text-[10px] text-blue-400 font-bold max-w-full truncate mt-0.5">{profileCargo || 'Cargo Sacerdotal'}</p>
                                    <span className="inline-block mt-1 bg-blue-950/40 text-cyan-400 border border-cyan-500/10 text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wide max-w-full truncate">
                                      🏛️ {profileTerreiro || 'Nome do Templo'}
                                    </span>
                                  </div>

                                  <div className="pt-2.5 border-t border-[#1E242B]/80 text-[9px] text-[#94A3B8] leading-normal flex items-center justify-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    Sincronia com Corrente Sacerdotal Ativada
                                  </div>

                                </div>
                              </div>

                              {/* Example signature card */}
                              <div className="p-3 bg-zinc-950/40 rounded-xl border border-[#1E242B]/70 space-y-1">
                                <span className="block text-[8px] uppercase tracking-wider font-extrabold text-blue-400">Assinatura no WhatsApp Automatizado:</span>
                                <p className="text-[10px] text-gray-400 italic leading-relaxed font-light">
                                  "🕯️ Salve a Corrente! Lembra-se que hoje nossa sessão inicia às 20:00. Com amor, <strong>{profileName || 'Zelador'}</strong> do <strong>{profileTerreiro || 'Terreiro'}</strong>."
                                </p>
                              </div>

                            </div>

                          </div>

                        </div>
                      )}

                      {/* SUB-MENU CONTENT: INFORMAÇÕES DO TERREIRO (ILLUSTRATIVE & DECORATIVE FOR DEPTH) */}
                      {configSubTab === 'religioso' && (
                        <div className="bg-[#13171D] p-5 sm:p-6 rounded-2xl border border-[#1E242B] space-y-5 animate-fadeIn">
                          <div className="flex items-center justify-between border-b border-[#1E242B] pb-3.5">
                            <div>
                              <h6 className="font-display font-bold text-sm text-[#F1F5F9]">Informações Litúrgicas do Templo</h6>
                              <p className="text-[11px] text-gray-400 mt-0.5 font-light">Especifique as linhas de trabalho espirituais dominantes e a localização de caridade.</p>
                            </div>
                            <span className="text-[8px] uppercase tracking-wider px-2 py-0.5 bg-cyan-950/30 text-cyan-400 border border-cyan-500/20 rounded font-black shrink-0">
                              Luz Espiritual
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="block text-[9px] font-bold text-[#94A3B8] uppercase">Fundação do Terreiro</label>
                              <input type="text" disabled value="15/11/2012" className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A]/40 text-gray-500 cursor-not-allowed" />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[9px] font-bold text-[#94A3B8] uppercase">Linha Dominante de Fé</label>
                              <input type="text" disabled value="Umbanda Sagrada" className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A]/40 text-gray-400 cursor-not-allowed" />
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <label className="block text-[9px] font-bold text-[#94A3B8] uppercase">Endereço Litúrgico do Congá</label>
                              <input type="text" disabled value="Sítio das Almas Sagradas, Km 4 - Estrada do Ouro" className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A]/40 text-gray-400 cursor-not-allowed" />
                            </div>
                          </div>

                          <div className="p-3 bg-cyan-500/5 rounded-xl border border-cyan-500/10 text-xs text-cyan-400 leading-relaxed font-light font-sans">
                            <strong>Nota Litúrgica:</strong> A edição de dados espaciais e linhagens adicionais do Templo está integrada à identidade de {profileTerreiro}. Atualmente as alterações estão centralizadas no Perfil de Sacerdote para manter consistência em tempo de execução no simulador.
                          </div>
                        </div>
                      )}

                      {/* SUB-MENU CONTENT: SEGURANÇA & API */}
                      {configSubTab === 'plataforma' && (
                        <div className="bg-[#13171D] p-5 sm:p-6 rounded-2xl border border-[#1E242B] space-y-5 animate-fadeIn">
                          <div className="flex items-center justify-between border-b border-[#1E242B] pb-3.5">
                            <div>
                              <h6 className="font-display font-bold text-sm text-[#F1F5F9]">Segurança de Acesso & API Tokens</h6>
                              <p className="text-[11px] text-gray-405 mt-0.5 font-light">Chaves de integração do webhook e credenciais do banco Axé Cloud.</p>
                            </div>
                            <span className="text-[8px] uppercase tracking-wider px-2 py-0.5 bg-emerald-950/30 text-[#10B981] border border-emerald-500/20 rounded font-black shrink-0">
                              Criptografia AES-256
                            </span>
                          </div>

                          <div className="space-y-3">
                            <div className="p-3 bg-[#12161A] rounded-xl border border-[#1E242B] flex items-center justify-between gap-1.5 text-xs text-gray-400">
                              <div>
                                <span className="block font-bold text-white text-[11px]">Token do Agente do Terreiro</span>
                                <span className="font-mono text-[9px] text-[#94A3B8]">axe_live_tk_******************e892cfa</span>
                              </div>
                              <span className="text-[8px] uppercase font-bold text-emerald-400 bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-500/15 shrink-0">Ativo</span>
                            </div>

                            <div className="p-3 bg-[#12161A] rounded-xl border border-[#1E242B] flex items-center justify-between gap-1.5 text-xs text-gray-400">
                              <div>
                                <span className="block font-bold text-white text-[11px]">Banco de Dados Corrente</span>
                                <span className="font-mono text-[9px] text-[#94A3B8]">firestore-cluster-axecloud-shared-prd</span>
                              </div>
                              <span className="text-[8px] uppercase font-bold text-emerald-400 bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-500/15 shrink-0">Protegido</span>
                            </div>
                          </div>

                          <p className="text-[10px] text-amber-500 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10 leading-normal font-light">
                            🔒 <strong>Proteção Litúrgica Contratual:</strong> Nenhuma entidade espiritual ou usuário comum sem privilégio de Zelador de Santo possui chaves de leitura sobre os canais confidenciais de orações e históricos financeiros de mensalidade do terreiro.
                          </p>
                        </div>
                      )}

                    </div>

                  </div>

                </div>
              )}

              {activeDashboardTab === 'galeria' && (
                <div className="space-y-6 animate-fadeIn text-[#F1F5F9]">
                  
                  {/* HEADER GENERAL DA GALERIA */}
                  <div className="border-b border-[#1E242B] pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h5 className="font-display font-black text-xl text-white flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-amber-500" />
                        Relicário de Axé (Mural de Lembranças)
                      </h5>
                      <p className="text-xs text-[#94A3B8]">
                        Um álbum sagrado de recordações fotográficas das nossas giras, obrigações rituais e eventos comunitários.
                      </p>
                    </div>

                    {/* Sacerdote-only Trigger for Add Photo */}
                    {userRole === 'zelador' && (
                      <button
                        onClick={() => {
                          const el = document.getElementById('add-photo-section');
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth' });
                          } else {
                            showNotification('Preencha os campos abaixo para publicar uma lembrança!', 'info');
                          }
                        }}
                        className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-black px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <Camera className="w-4 h-4" />
                        Eternizar Nova Lembrança
                      </button>
                    )}
                  </div>

                  {/* GALLERY INTRO / STATS CARDS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-[#13171D] p-4 rounded-xl border border-[#1E242B] flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest">Lembranças Salvas</span>
                        <span className="text-lg font-black text-white">{galleryPhotos.length} Fotos Registradas</span>
                      </div>
                    </div>

                    <div className="bg-[#13171D] p-4 rounded-xl border border-[#1E242B] flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20 animate-pulse" />
                      </div>
                      <div>
                        <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest">Vibrações de Axé</span>
                        <span className="text-lg font-black text-white">
                          {galleryPhotos.reduce((sum, ph) => sum + (ph.likes || 0), 0)} Consagrações
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#13171D] p-4 rounded-xl border border-[#1E242B] flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest">Nível de Membros</span>
                        <span className="text-lg font-black text-white">Todas as Linhagens Ativas</span>
                      </div>
                    </div>
                  </div>

                  {/* MAIN SPLIT-PANE SECTION */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    <div className="lg:col-span-12 space-y-8">
                      
                      {/* ONLY SACERDOTES / ZELADORES CAN VIEW AND POST NEW PHOTOS */}
                      {userRole === 'zelador' && (
                        <div id="add-photo-section" className="bg-[#13171D] p-6 rounded-3xl border border-amber-500/10 space-y-6 relative overflow-hidden shadow-xl">
                          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
                          
                          <div className="border-b border-[#1E242B] pb-4">
                            <h6 className="font-display font-black text-sm text-[#FACC15] flex items-center gap-2">
                              <Camera className="w-4 h-4" />
                              Painel de Publicação Litúrgica (Exclusivo Zeladoria)
                            </h6>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              Registre uma foto marcante para que todos os filhos de o santo possam contemplar as vibrações positivas no painel.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            <div className="space-y-4 md:col-span-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="block text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Título da Lembrança</label>
                                  <input
                                    type="text"
                                    value={newPhotoTitulo}
                                    onChange={(e) => setNewPhotoTitulo(e.target.value)}
                                    placeholder="Ex: Festa da Iansã, Batismo de Abassá..."
                                    className="w-full text-xs p-2.5 rounded-xl border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Tipo da Atividade</label>
                                  <select
                                    value={newPhotoCategoria}
                                    onChange={(e) => setNewPhotoCategoria(e.target.value as any)}
                                    className="w-full text-xs p-2.5 rounded-xl border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                                  >
                                    <option value="gira">Gira de Trabalho</option>
                                    <option value="evento">Festa / Evento Público</option>
                                    <option value="lembranca">Lembrança das Linhagens</option>
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Breve História ou Legenda Espiritual</label>
                                <textarea
                                  value={newPhotoLegenda}
                                  onChange={(e) => setNewPhotoLegenda(e.target.value)}
                                  rows={2}
                                  placeholder="Escreva sobre a energia do dia, as entidades que trabalharam ou o preceito realizado..."
                                  className="w-full text-xs p-2.5 rounded-xl border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">URL do Arquivo Fotográfico (Link da Imagem)</label>
                                <input
                                  type="text"
                                  value={newPhotoUrl}
                                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                                  placeholder="Cole um link ou use um dos nossos cartões predefinidos do acervo de Axé ao lado —>"
                                  className="w-full text-xs p-2.5 rounded-xl border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="bg-[#0C0E12]/80 p-4 rounded-2xl border border-[#1E242B] space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-black tracking-widest text-[#FACC15]">Escolha uma Foto do Acervo</span>
                                <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">6 Presets</span>
                              </div>
                              <p className="text-[9.5px] text-gray-500 leading-normal">
                                Selecione uma fotografia espiritual simbólica em alta qualidade do nosso acervo integrado da natureza e energia ritual:
                              </p>
                              
                              <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                                {[
                                  { label: '🕯️ Fogo & Velas', url: 'https://images.unsplash.com/photo-1545239351-ef35f43d514b?auto=format&fit=crop&q=80&w=600' },
                                  { label: '✨ Luz de Congá', url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&q=80&w=600' },
                                  { label: '🌿 Ervas e Força', url: 'https://images.unsplash.com/photo-1606293926075-69a00dbf2972?auto=format&fit=crop&q=80&w=600' },
                                  { label: '🤝 Mãos e Guia', url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&q=80&w=600' },
                                  { label: '🌊 Mar de Mãe Iemanjá', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=600' },
                                  { label: '💦 Oxum Cachoeira', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=600' }
                                ].map((p, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setNewPhotoUrl(p.url);
                                      showNotification(`Fotografia "${p.label}" selecionada com êxito!`, 'info');
                                    }}
                                    className={`p-2 rounded-xl text-left border text-[9px] font-bold transition-all truncate cursor-pointer ${
                                      newPhotoUrl === p.url
                                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-extrabold'
                                        : 'bg-[#12161A] border-[#1E242B] text-gray-400 hover:border-gray-600'
                                    }`}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                          </div>

                          <div className="flex border-t border-[#1E242B] pt-4 items-center justify-between gap-4">
                            <span className="text-[9.5px] text-gray-550 italic font-mono">Assinado por {profileName} (Sacerdote)</span>
                            <div className="flex items-center gap-2">
                              {newPhotoTitulo && newPhotoUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewPhotoTitulo('');
                                    setNewPhotoLegenda('');
                                    setNewPhotoUrl('');
                                    showNotification('Campos limpos!', 'info');
                                  }}
                                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!newPhotoTitulo.trim()) {
                                    showNotification('Defina o título da lembrança fotográfica!', 'error');
                                    return;
                                  }
                                  if (!newPhotoUrl.trim()) {
                                    showNotification('Associe uma URL válida ou selecione uma predefinição!', 'error');
                                    return;
                                  }

                                  const created: GalleryPhoto = {
                                    id: `photo-${Date.now()}`,
                                    url: newPhotoUrl,
                                    titulo: newPhotoTitulo,
                                    legenda: newPhotoLegenda || 'Memória com boas energias guardadas no mural do terreiro.',
                                    categoria: newPhotoCategoria,
                                    autor: profileName,
                                    data: new Date().toLocaleDateString('pt-BR'),
                                    likes: 3
                                  };

                                  setGalleryPhotos([created, ...galleryPhotos]);
                                  setNewPhotoTitulo('');
                                  setNewPhotoLegenda('');
                                  setNewPhotoUrl('');
                                  showNotification('Lembrança eternizada no mural e compartilhada com todos os membros! Parabéns, Zelador.', 'success');
                                }}
                                className="bg-[#2E5A44]/60 hover:bg-[#2E5A44] text-[#10B981] border border-emerald-500/25 px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow"
                              >
                                🌟 Eternizar no Mural
                              </button>
                            </div>
                          </div>

                        </div>
                      )}

                      {/* FILTERING HEADER & CHIPS MURAL */}
                      <div className="bg-[#13171D] p-5 rounded-2xl border border-[#1E242B] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-1 text-center sm:text-left">
                          <h6 className="text-xs font-extrabold uppercase text-gray-450 tracking-wider">Mural de Memórias Ativas</h6>
                          <p className="text-[10px] text-gray-500">Filtrar os álbuns sagrados publicados de Giras e Eventos Litúrgicos.</p>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {[
                            { value: 'tudo', label: 'Ver Tudo 🎨' },
                            { value: 'gira', label: 'Giras de Santo 🕯️' },
                            { value: 'evento', label: 'Festas & Rituais 🏛️' },
                            { value: 'lembranca', label: 'União do Terreiro 🌿' }
                          ].map((f) => (
                            <button
                              key={f.value}
                              onClick={() => {
                                setActiveGalleryFilter(f.value as any);
                                showNotification(`Visualizando lembranças: ${f.label.split(' ')[1] || 'Tudo'}`);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer transition-all ${
                                activeGalleryFilter === f.value
                                  ? 'bg-[#D97706] text-white shadow-sm'
                                  : 'bg-[#12161A] text-[#94A3B8] border border-[#1E242B] hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* PHOTOS GRID SYSTEM */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {(() => {
                          const filtered = galleryPhotos.filter(p => activeGalleryFilter === 'tudo' || p.categoria === activeGalleryFilter);

                          if (filtered.length === 0) {
                            return (
                              <div className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 p-12 bg-[#0C0E12] rounded-3xl border border-[#1E242B] text-center space-y-3">
                                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto text-amber-500 text-lg">📸</div>
                                <h6 className="font-display font-bold text-xs text-white">Nenhum registro fotográfico nesta seção</h6>
                                <p className="text-[11px] text-gray-550 max-w-sm mx-auto">
                                  {userRole === 'zelador' 
                                    ? 'Suba uma foto no formulário de eternização acima para publicar seu primeiro arquivo sagrado!' 
                                    : 'Ainda não foram publicadas lembranças rituais para este filtro.'}
                                </p>
                              </div>
                            );
                          }

                          return filtered.map((photo) => {
                            const badgeConfig = {
                              gira: 'bg-yellow-950/50 text-[#FACC15] border-yellow-500/20',
                              evento: 'bg-blue-950/50 text-cyan-400 border-cyan-500/20',
                              lembranca: 'bg-emerald-950/50 text-[#10B981] border-emerald-500/20'
                            }[photo.categoria];

                            return (
                              <div
                                key={photo.id}
                                className="bg-[#13171D] rounded-2xl border border-[#1E242B] overflow-hidden hover:border-amber-500/20 transition-all flex flex-col justify-between group h-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transform duration-300 relative"
                              >
                                
                                <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                                  <img
                                    src={photo.url}
                                    alt={photo.titulo}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1545239351-ef35f43d514b?auto=format&fit=crop&q=80&w=600';
                                    }}
                                  />
                                  <div className="absolute top-2 left-2 flex items-center gap-1">
                                    <span className={`text-[8.5px] font-black uppercase px-2.5 py-0.5 border rounded ${badgeConfig}`}>
                                      {photo.categoria === 'gira' ? 'Gira Ativa' : photo.categoria === 'evento' ? 'Festa / Ritual' : 'Preceito'}
                                    </span>
                                  </div>

                                  {userRole === 'zelador' && (
                                    <button
                                      onClick={() => {
                                        const confirmDel = window.confirm(`Deseja mesmo remover a lembrança "${photo.titulo}" permanente de toda a corrente?`);
                                        if (confirmDel) {
                                          setGalleryPhotos(galleryPhotos.filter(p => p.id !== photo.id));
                                          showNotification(`Memória de "${photo.titulo}" removida.`, 'info');
                                        }
                                      }}
                                      className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-black/60 hover:bg-rose-950 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer border border-[#1E242B]"
                                      title="Deletar Lembrança"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>

                                <div className="p-4 space-y-3.5 flex-grow flex flex-col justify-between">
                                  <div className="space-y-1.5">
                                    <h6 className="font-display font-black text-xs text-white leading-snug group-hover:text-[#FACC15] transition-colors">
                                      {photo.titulo}
                                    </h6>
                                    <p className="text-[10.5px] text-gray-400 leading-relaxed font-light line-clamp-3">
                                      {photo.legenda}
                                    </p>
                                  </div>

                                  <div className="pt-3 border-t border-[#1E242B]/80 flex items-center justify-between gap-2.5 text-[9.5px]">
                                    
                                    <div className="space-y-0.5 text-gray-500 max-w-[60%]">
                                      <span className="block font-black text-[#F1F5F9]/80 truncate">Por: {photo.autor}</span>
                                      <span className="block font-mono text-[8.5px]">{photo.data}</span>
                                    </div>

                                    <button
                                      onClick={() => {
                                        const updated = galleryPhotos.map((p) => {
                                          if (p.id === photo.id) {
                                            return { ...p, likes: (p.likes || 0) + 1 };
                                          }
                                          return p;
                                        });
                                        setGalleryPhotos(updated);
                                        showNotification(`Você enviou vibrações de Axé para: "${photo.titulo}"! ✨`, 'success');
                                      }}
                                      className="bg-rose-950/20 hover:bg-rose-950/50 border border-rose-500/10 text-rose-400 px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none active:scale-95 shrink-0"
                                    >
                                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
                                      <span>{photo.likes || 0} Axé</span>
                                    </button>

                                  </div>
                                </div>

                              </div>
                            );
                          });
                        })()}
                      </div>

                    </div>

                  </div>

                </div>
              )}
                </>
              )}

            </div>
          </div>
        </div>
      </section>

          {/* DETAILED DATA PRIVACY & SEGURANÇA PLATAFORMA */}
      <section id="seguranca" className="py-20 md:py-24 bg-[#0B0F13] border-t border-[#1E242B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            {/* Image / Vector Symbol Representation */}
            <div className="order-2 lg:order-1 relative">
              <div className="aspect-[4/3] rounded-3xl bg-[#13171D] overflow-hidden border border-[#1E242B] flex items-center justify-center p-8 relative">
                
                {/* Simulated database lock interface */}
                <div className="bg-[#12161A] rounded-2xl shadow-xl w-full p-6 border border-[#1E242B]">
                  <div className="flex items-center gap-2 border-b border-[#1E242B] pb-3.5 mb-4">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Protocolo de Sigilo Religioso Axé-Lock</span>
                  </div>

                  <div className="space-y-3 font-mono text-[10px] text-[#94A3B8]">
                    <p className="flex justify-between">
                      <span>{'>'} ESTADO DO BANCO:</span>
                      <span className="text-emerald-400 font-bold">100% ENCRIPTADO</span>
                    </p>
                    <p className="flex justify-between">
                      <span>{'>'} DIRETRIZ LGPD:</span>
                      <span className="text-[#F1F5F9]">DADOS SENSÍVEIS (ALTA SEGURANÇA)</span>
                    </p>
                    <p className="flex justify-between">
                      <span>{'>'} BACKUP AUTOMÁTICO:</span>
                      <span className="text-sky-400 font-bold">DE HORA EM HORA</span>
                    </p>
                    <div className="border border-emerald-950 bg-emerald-950/40 p-2.5 rounded-lg text-emerald-300 text-[10px] font-sans">
                      Diferente de redes sociais públicas, os dados de assentamentos, obrigações espirituais e fichas litúrgicas nunca são monitorados por sistemas de anúncio ou buscadores como o Google.
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-[#FACC15]/10 rounded-full blur-2xl -z-10" />
              </div>
            </div>

            {/* Privacy details copy */}
            <div className="order-1 lg:order-2 space-y-6">
              <span className="text-xs font-bold text-[#FACC15] uppercase tracking-widest block">Inviolabilidade Histórica</span>
              
              <h3 className="font-display font-black text-3.5xl md:text-4.5xl tracking-tight text-[#F1F5F9]">
                Seus dados preservados com o máximo sigilo profissional
              </h3>
              
              <p className="text-sm md:text-base text-[#94A3B8] font-light leading-relaxed">
                Reconhecemos a extrema seriedade que envolve os nomes ritualísticos e preparos internos de terreiros tradicionais de matriz africana. O Axé Cloud segue rigorosamente as leis civis de dados (LGPD) sob a tutela de dados religiosos extremamente sensíveis.
              </p>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-850 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-[#F1F5F9]">Sem publicidade ou cookies rastreadores</h5>
                    <p className="text-xs text-[#94A3B8]">Seus dados nunca serão expostos ou mercantilizados por anunciantes terceiros.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-850 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-[#F1F5F9]">Backup Em Nuvem Redundante</h5>
                    <p className="text-xs text-[#94A3B8]">Segurança física com servidores duplicados localizados confidencialmente na América Latina.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-850 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-[#F1F5F9]">Exportação Completa de Dados</h5>
                    <p className="text-xs text-[#94A3B8]">Você é dono da sua própria história. Exporte relatórios ou todas as listas em PDF e Excel com apenas um clique.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* DYNAMIC PRICING SLIDER & CALCULATOR AREA */}
      <section id="calculadora" className="py-20 md:py-24 bg-[#0A0D10] border-y border-[#1E242B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-[#FACC15] uppercase tracking-widest block mb-2">Preços Justos</span>
            <h2 className="font-display font-black text-3.5xl md:text-5xl tracking-tight text-[#F1F5F9]">
              Quanto custa o Axé Cloud?
            </h2>
            <p className="mt-4 text-[#94A3B8] text-sm md:text-base font-light">
              Nossa missão é fortalecer todos os Terreiros do Brasil. Arraste o seletor abaixo correspondente ao número de médiuns ativos na sua casa e veja os recursos adequados para você:
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-[#13171D] p-6 md:p-10 rounded-3xl border border-[#1E242B] shadow-2xl">
            
            {/* Interactive Slider element */}
            <div className="mb-10 text-center space-y-4">
              <label className="block text-sm font-bold text-[#F1F5F9] uppercase tracking-wide">
                Quantos médiuns ativos frequentam sua casa?
              </label>
              
              {/* Dynamic Number Display */}
              <div className="text-4xl md:text-5xl font-black text-[#FACC15] font-display flex items-center justify-center gap-1.5">
                <span>{mediumsSliderValue}</span>
                <span className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider bg-[#1E2530] py-1 px-2.5 rounded-lg border border-[#1E242B]">Médiuns</span>
              </div>

              {/* Real Input HTML5 slider */}
              <input
                id="slider-pricing-mediums"
                type="range"
                max="100"
                min="5"
                step="1"
                value={mediumsSliderValue}
                onChange={(e) => setMediumsSliderValue(parseInt(e.target.value))}
                className="w-full h-2.5 bg-[#12161A] rounded-lg appearance-none cursor-pointer accent-[#FACC15] block my-4"
              />
              <div className="flex items-center justify-between text-[10px] text-[#94A3B8] font-bold px-1">
                <span>5 Médiuns</span>
                <span>30 Médiuns</span>
                <span>50 Médiuns</span>
                <span>100+ Médiuns</span>
              </div>
            </div>

            {/* Calculated Plan Response Card Layout */}
            <div className="bg-[#12161A] p-6 rounded-2xl border border-[#1E242B] grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              
              {/* Left Column: Plan name price */}
              <div className="space-y-4">
                <span className="text-[10px] bg-[#13171D] text-[#F1F5F9] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest border border-[#FACC15]/30">
                  Plano Recomendado
                </span>
                
                <h4 className="font-display font-extrabold text-2xl text-[#F1F5F9]" id="pricing-plan-name">
                  {calculatedPlan.name}
                </h4>
                
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  {calculatedPlan.desc}
                </p>

                {/* Pricing detail */}
                <div className="pt-2">
                  <div className="flex items-baseline gap-1" id="pricing-plan-value">
                    <span className="text-4xl font-black text-[#FACC15] font-display">{calculatedPlan.price}</span>
                    <span className="text-xs font-semibold text-[#94A3B8]">/{calculatedPlan.priceLabel}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold block mt-1">14 dias livres para experimentar sem compromisso</span>
                </div>

                <div className="pt-4">
                  <button
                    id="btn-confirm-pricing-selection"
                    onClick={() => showNotification(`Seu teste para ${mediumsSliderValue} médiuns foi ativado no ambiente virtual!`, "success")}
                    className="w-full bg-[#FACC15] hover:bg-[#FDE047] text-[#080A0D] font-bold text-xs py-3 rounded-xl transition-all shadow-md text-center inline-block"
                  >
                    Iniciar Teste de 14 Dias Grátis
                  </button>
                </div>
              </div>

              {/* Right Column: Features included */}
              <div className="bg-[#13171D] p-5 rounded-xl border border-[#1E242B] space-y-3 shadow-inner">
                <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest border-b border-[#1E242B] pb-2">
                  O que está incluído:
                </p>
                <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
                  {calculatedPlan.recursos.map((rec, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-2 text-xs text-[#94A3B8]">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* DETAILED ACCORDION FAQ */}
      <section className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-xs font-bold text-[#FACC15] uppercase tracking-widest block mb-2">Esclarecendo Dúvidas</span>
          <h2 className="font-display font-black text-3xl md:text-4.5xl tracking-tight text-[#F1F5F9]">
            Perguntas Frequentes do Terreiro
          </h2>
          <p className="mt-3 text-[#94A3B8] font-light text-sm max-w-xl mx-auto">
            Se sua dúvida não estiver respondida aqui, entre em contato com nossa assessoria diretamente pelo WhatsApp de plantão.
          </p>
        </div>

        {/* Interactive Accordion panel */}
        <div className="space-y-3.5">
          {faqs.map((f) => {
            const isExpanded = faqExpanded[f.id];
            return (
              <div
                key={f.id}
                className="bg-[#13171D] rounded-2xl border border-[#1E242B] overflow-hidden transition-all shadow-md"
              >
                <button
                  id={`btn-faq-toggle-${f.id}`}
                  onClick={() => toggleFaq(f.id)}
                  className="w-full text-left p-5 flex items-center justify-between gap-4 font-bold text-[#F1F5F9] text-sm md:text-base focus:outline-none hover:bg-[#1E242B]/80 transition-colors"
                >
                  <span>{f.question}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#FACC15] flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="p-5 pt-0 text-xs md:text-sm text-[#94A3B8] leading-relaxed border-t border-[#1E242B] animate-fadeIn">
                    {f.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FINAL CONCLUDING FOOTER CTA PANEL */}
      <section className="py-16 md:py-20 text-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#13171D] to-[#1E2530] rounded-[40px] text-white my-12 relative overflow-hidden shadow-2xl border border-[#FACC15]/30">
        
        {/* Subtle background items */}
        <div className="absolute top-1/2 left-20 -translate-y-1/2 text-white/5 pointer-events-none">
          <Flame className="w-64 h-64 pointer-events-none" />
        </div>
        <div className="absolute top-1/3 right-12 text-[#FACC15]/5 pointer-events-none">
          <Sparkles className="w-44 h-44 pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <span className="text-xs font-bold text-[#FACC15] uppercase tracking-widest block font-display">Inicie Sem Custos</span>
          
          <h2 className="font-display font-black text-3.5xl md:text-4.5xl leading-tight tracking-tight text-[#F1F5F9]">
            Leve paz de espírito e profissionalismo à sua casa religiosa
          </h2>
          
          <p className="text-xs md:text-sm text-[#94A3B8] font-light leading-relaxed max-w-lg mx-auto">
            Organize seu corpo de médiuns, defenda os dados do seu terreiro contra a intolerância e mantenha um fluxo financeiro saudável de forma transparente.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
            <button
              id="btn-cta-footer-trial"
              onClick={() => showNotification("Simulador: Obrigado pelo interesse no Axé Cloud! Atendemos terreiros em todo o Brasil.", "success")}
              className="w-full sm:w-auto bg-[#FACC15] hover:bg-[#FDE047] text-[#080A0D] font-black text-xs uppercase tracking-wider px-6 py-4 rounded-xl shadow-lg transition-all"
            >
              Iniciar Teste Grátis
            </button>
            <button
              id="btn-cta-footer-talk"
              onClick={() => showNotification("Para falar no WhatsApp, contate o telefone oficial em produção.", "info")}
              className="w-full sm:w-auto bg-transparent hover:bg-white/5 text-[#F1F5F9] font-semibold text-xs px-6 py-4 rounded-xl border border-white/20 transition-all"
            >
              Falar com Guardião do Suporte
            </button>
          </div>
        </div>
      </section>
        </>
      ) : (
        <div id="portal-do-fiel" className="py-12 md:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-fadeIn">
          
          {/* Header Row */}
          <div className="text-center max-w-3xl mx-auto mb-16 relative">
            <span className="text-xs font-bold text-rose-400 bg-rose-950/20 px-3 py-1.5 rounded-full uppercase tracking-wider inline-block mb-3 border border-rose-500/20 animate-pulse">
              ❤️ Espaço do Fiel & Caridade Litúrgica
            </span>
            <h2 className="font-display font-black text-3.5xl md:text-5xl tracking-tight text-[#F1F5F91]">
              Portal Público de Pedidos de Reza
            </h2>
            <p className="mt-4 text-[#94A3B8] text-sm md:text-base font-light mx-auto max-w-2xl">
              Este é o **ambiente dedicado do visitante e herdeiro de fé**. Com total privacidade e respeito, você pode selecionar uma casa de acolhimento parceira por cidade, firmar seus pedidos secretos de reza e sintonizar as correntes virtuais no Altar do Congá.
            </p>
          </div>

          {/* STEP 1: SELECT HOUSE BY CITY */}
          <div className="bg-[#13171D] p-6 rounded-3xl border border-[#1E242B] mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full filter blur-2xl pointer-events-none" />
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-[#1E242B] mb-6">
              <div>
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-[0.2em] block mb-1">Passo 1 • Localização da Fé</span>
                <h3 className="font-display font-extrabold text-xl text-[#F1F5F9] flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-rose-500" />
                  Selecione o Terreiro por Cidade
                </h3>
                <p className="text-[#94A3B8] text-xs font-light mt-1">
                  Encontre a casa religiosa na sua cidade ou a mais próxima se identificando abaixo:
                </p>
              </div>

              {/* City selector buttons */}
              <div className="flex flex-wrap gap-1.5">
                {['Todas', 'São Paulo', 'Rio de Janeiro', 'Salvador', 'Belo Horizonte', 'Curitiba', 'Porto Alegre'].map((city) => {
                  const isActive = selectedCity === city;
                  return (
                    <button
                      key={city}
                      onClick={() => setSelectedCity(city)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                        isActive 
                          ? 'bg-[#FACC15] text-[#080A0D] font-bold shadow-md shadow-[#FACC15]/20' 
                          : 'bg-[#12161A] text-[#94A3B8] border border-[#1E242B] hover:text-[#F1F5F9] hover:bg-[#1C232B]'
                      }`}
                    >
                      {city === 'Todas' ? '📍 Todas as Cidades' : city}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Terreiros Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CASAS_PARCEIRAS.filter(c => selectedCity === 'Todas' || c.cidade === selectedCity).map((casa) => {
                const isSelected = publicPrayerRequest.casa === casa.nome;
                return (
                  <div
                    key={casa.id}
                    onClick={() => {
                      setPublicPrayerRequest({ ...publicPrayerRequest, casa: casa.nome });
                      showNotification(`Terreiro "${casa.nome}" selecionado!`, 'success');
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#1E2530] border-[#FACC15] shadow-lg shadow-[#FACC15]/5 scale-[1.02]'
                        : 'bg-[#0F1216] border-[#1E242B] hover:border-[#94A3B8]/30 hover:bg-[#12161A]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[8px] uppercase tracking-wider font-extrabold bg-[#12161A] text-amber-500 px-2.5 py-1 rounded border border-[#FACC15]/10 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> Terreiro Parceiro
                        </span>
                        <span className="text-[10px] font-bold text-[#FACC15]">{casa.estado}</span>
                      </div>
                      
                      <h4 className="font-display font-bold text-xs text-[#F1F5F9] line-clamp-1 mb-1.5">{casa.nome}</h4>
                      <p className="text-[10.5px] text-gray-400 font-light leading-relaxed mb-4 flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-gray-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{casa.endereco}</span>
                      </p>
                    </div>

                    <div className="border-t border-[#1E242B]/80 pt-3 flex items-center justify-between text-[10px]">
                      <span className="text-gray-500 font-mono italic">{casa.cidade}</span>
                      <span className={`font-bold uppercase tracking-wider transition-all ${
                        isSelected ? 'text-[#FACC15] text-[10.5px]' : 'text-gray-400 hover:text-[#FACC15]'
                      }`}>
                        {isSelected ? '✓ Selecionado' : 'Selecionar'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* If no houses in selected city */}
            {CASAS_PARCEIRAS.filter(c => selectedCity === 'Todas' || c.cidade === selectedCity).length === 0 && (
              <div className="p-8 text-center text-gray-500 border border-dashed border-[#1E242B] rounded-2xl bg-[#0F1216] my-2">
                Nenhum terreiro cadastrado nesta cidade ainda. Experimente selecionar "Todas as Cidades" ou escolher uma cidade vizinha.
              </div>
            )}
          </div>

          {/* STEP 2: CHOOSE AND SEND PRAYER AND MONITOR */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* COLUMN 1: NEW PRAYER FORM (Visitor perspective) */}
            <div className="lg:col-span-5 bg-[#13171D] p-6 rounded-3xl border border-[#1E242B] shadow-inner flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-4 border-b border-[#1E242B] pb-3">
                  <Flame className="w-5 h-5 text-rose-500 fill-rose-500/10 animate-pulse" />
                  <h3 className="font-display font-bold text-base text-[#F1F5F9]">Formulário Oficial de Amparo</h3>
                </div>
                
                <form onSubmit={handleAddPublicPrayer} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Terreiro de Destino Selecionado</label>
                    <div className="p-3 bg-[#12161A] rounded-lg border border-[#1E242B] flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">{publicPrayerRequest.casa}</span>
                      <span className="text-[9px] uppercase tracking-wider text-[#94A3B8] font-mono">Pronto</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Nome Completo (ou Iniciais de quem precisa)</label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos de Souza"
                      value={publicPrayerRequest.solicitante}
                      onChange={(e) => setPublicPrayerRequest({...publicPrayerRequest, solicitante: e.target.value})}
                      className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none placeholder:text-gray-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Tipo de Pedido</label>
                      <select
                        value={publicPrayerRequest.categoria}
                        onChange={(e) => setPublicPrayerRequest({...publicPrayerRequest, categoria: e.target.value})}
                        className="w-full text-xs p-2 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                      >
                        <option value="Proteção / Defesa Espiritual">Proteção / Defesa</option>
                        <option value="Saúde / Restabelecimento">Saúde / Cura</option>
                        <option value="Abertura de Caminhos / Prosperidade">Caminhos / Emprego</option>
                        <option value="Limpeza Espiritual / Descarrego">Limpeza / Cansaço</option>
                        <option value="Equilíbrio Emocional / Clamor por Paz">Paz de Espírito</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Linha de Trabalho</label>
                      <select
                        value={publicPrayerRequest.linha}
                        onChange={(e) => setPublicPrayerRequest({...publicPrayerRequest, linha: e.target.value})}
                        className="w-full text-xs p-2 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none"
                      >
                        <option value="Caboclos">Caboclos (Força)</option>
                        <option value="Pretos Velhos / Almas">Pretos Velhos (Sabedoria)</option>
                        <option value="Baianos e Boiadeiros">Baianos / Boiadeiros</option>
                        <option value="Exu / Caminhos">Exu (Proteção)</option>
                        <option value="Marinheiros / Iemanjá">Marinheiros (Purificação)</option>
                      </select>
                    </div>
                  </div>

                  {/* Candle grid in form */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Firmeza Virtual - Cor da Vela</label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {[
                        { color: 'Branca', bg: 'bg-white text-gray-950 border-gray-400' },
                        { color: 'Vermelha', bg: 'bg-red-600 text-white border-red-800' },
                        { color: 'Azul', bg: 'bg-blue-600 text-white border-blue-800' },
                        { color: 'Verde', bg: 'bg-emerald-600 text-white border-emerald-850' },
                        { color: 'Amarela', bg: 'bg-yellow-500 text-gray-950 border-yellow-700' },
                        { color: 'Preta', bg: 'bg-gray-950 text-white border-gray-900' },
                        { color: 'Nenhuma', bg: 'bg-transparent text-[#94A3B8] border-[#1E242B]' }
                      ].map((v) => {
                        const isSelected = publicPrayerRequest.vela === v.color;
                        return (
                          <button
                            key={v.color}
                            type="button"
                            onClick={() => setPublicPrayerRequest({...publicPrayerRequest, vela: v.color as any})}
                            className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-center border transition-all cursor-pointer ${
                              isSelected 
                                ? 'border-[#FACC15] bg-[#12161A]' 
                                : 'border-[#1E242B] bg-[#12161A]/40 hover:bg-[#12161A]'
                            }`}
                          >
                            <span className={`w-3 h-3 rounded-full ${v.bg} border flex items-center justify-center shadow`}>
                              {isSelected && <Check className="w-2 h-2" />}
                            </span>
                            <span className="text-[8px] font-bold text-[#F1F5F9] mt-1">{v.color}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Sua Intenção / Prece Particular</label>
                    <textarea
                      rows={4}
                      placeholder="Escreva com sinceridade suas aflições ou dificuldades... Suas palavras serão enviadas com total privacidade diretamente ao Congá da casa."
                      value={publicPrayerRequest.intencao}
                      onChange={(e) => setPublicPrayerRequest({...publicPrayerRequest, intencao: e.target.value})}
                      className="w-full text-xs p-2.5 rounded-lg border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none placeholder:text-gray-650 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md uppercase tracking-wider cursor-pointer"
                  >
                    <Heart className="w-4 h-4 fill-current animate-pulse text-rose-200" />
                    Enviar Pedido de Reza & Acender Vela
                  </button>
                </form>
              </div>

              <div className="mt-4 p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 text-[10px] text-gray-400">
                🔒 <strong>Amparo Privado:</strong> Toda comunicação é criptografada e restrita estritamente ao Zelador da sua casa de acolhimento. Seu pedido não será divulgado publicamente no site.
              </div>
            </div>

            {/* COLUMN 2: ACTIVE PRAYER MONITOR (Interactive tracker area) */}
            <div className="lg:col-span-7 bg-[#13171D] p-6 rounded-3xl border border-[#1E242B] flex flex-col justify-between">
              
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E242B] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <h3 className="font-display font-bold text-base text-[#F1F5F9]">Altar Virtual & Seus Pedidos Ativos</h3>
                  </div>
                  <span className="text-[10px] text-[#94A3B8] bg-[#12161A] px-2 py-1 rounded border border-[#1E242B]">
                    Dispositivo Autenticado
                  </span>
                </div>

                {/* Sub-block 1: List of Active Requests */}
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-2">Pedidos na sua corrente de fé:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[140px] overflow-y-auto pr-1">
                    {prayerRequests.map((req) => {
                      const isSelected = req.id === publicSelectedId;
                      const statusColorMap = {
                        Pendente: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
                        Aceito: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
                        'Em Oração': 'border-violet-500/30 bg-violet-500/5 text-violet-400 animate-pulse'
                      };
                      return (
                        <div
                          key={req.id}
                          onClick={() => setPublicSelectedId(req.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-[#1E2530] border-[#FACC15]' 
                              : 'bg-[#12161A] border-[#1E242B] hover:bg-[#1E2530]/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-[11px] text-[#F1F5F9] truncate">{req.solicitante}</span>
                            <span className="text-[8px] text-gray-500">{req.data.split(' ')[0] || req.data}</span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-1 text-[9px]">
                            <span className="text-gray-400 truncate">{req.casa.replace('Terreiro ', '').replace('Centro ', '').replace('Templo ', '')}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${statusColorMap[req.status] || ''}`}>
                              {req.status === 'Em Oração' ? 'Prece Ativa' : req.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sub-block 2: Detailed Tracker & Altar Frame */}
                {(() => {
                  const selectedReq = prayerRequests.find(r => r.id === publicSelectedId);
                  if (!selectedReq) {
                    return (
                      <div className="p-8 text-center text-gray-500 border border-dashed border-[#1E242B] rounded-2xl bg-[#12161A]/50">
                        Nenhum pedido de oração selecionado para acompanhamento. Clique em um pedido acima ou adicione um no formulário.
                      </div>
                    );
                  }

                  const candleColorHexMap: Record<string, string> = {
                    Branca: '#FFFFFF',
                    Vermelha: '#EF4444',
                    Azul: '#3B82F6',
                    Verde: '#10B981',
                    Amarela: '#F59E0B',
                    Preta: '#27272A',
                    Nenhuma: '#6B7280'
                  };

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      
                      {/* Left: Active Candle Visual Frame */}
                      <div className="md:col-span-4 bg-[#12161A] p-4 rounded-2xl border border-[#1E242B] flex flex-col items-center justify-center relative overflow-hidden h-[180px]">
                        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[7.5px] uppercase tracking-wider font-bold text-gray-500 text-center">
                          Vela de Amparo
                        </div>

                        {selectedReq.vela !== 'Nenhuma' ? (
                          <div className="flex flex-col items-center mt-2">
                            {/* Animated flame based on status */}
                            {selectedReq.status !== 'Pendente' ? (
                              <div className="relative mb-1">
                                <svg className="w-5 h-7 text-[#FACC15] animate-bounce" viewBox="0 0 20 30" fill="currentColor">
                                  <path d="M10 0C6 8 4 14 4 19C4 25.1 8 30 10 30C12 30 16 25.1 16 19C15.9 14 14 8 10 0Z" className="text-amber-500 animate-pulse" />
                                  <path d="M10 6C8 11.3 7 15.3 7 18.7C7 22.8 9.7 26 10 26C10.3 26 13 22.8 13 18.7C13 15.3 12 11.3 10 6Z" className="text-yellow-300" />
                                </svg>
                                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-orange-500 rounded-full blur-md opacity-75 animate-ping" />
                              </div>
                            ) : (
                              <div className="h-7 flex items-center justify-center text-[8px] font-black text-amber-500/50 uppercase tracking-widest mb-1 italic animate-pulse">Aguardando Altar</div>
                            )}

                            {/* Candle Body */}
                            <div 
                              className="w-4 h-11 rounded-sm shadow-inner transition-all border border-black/20 relative"
                              style={{ backgroundColor: candleColorHexMap[selectedReq.vela] || '#FFFFFF' }}
                            >
                              <div className="absolute top-1 left-0 w-full h-0.5 opacity-40 bg-black/15" />
                              <div className="absolute top-1.5 left-[5px] w-1 h-3 rounded bg-black/10" />
                            </div>
                            <span className="text-[8px] font-bold text-[#F1F5F9] mt-2 uppercase">Vela {selectedReq.vela}</span>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Heart className="w-5 h-5 text-gray-650 mx-auto mb-1 animate-pulse" />
                            <span className="text-[8px] font-bold text-gray-500 block uppercase">Emanações de Fé</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Selected Request Details & Status Explainer */}
                      <div className="md:col-span-8 p-3.5 bg-[#12161A]/40 rounded-2xl border border-[#1E242B] flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-gray-500 uppercase font-bold">Destino: <strong className="text-[#F1F5F9]">{selectedReq.casa}</strong></span>
                            <span className="text-[#94A3B8]">{selectedReq.data}</span>
                          </div>
                          
                          <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed italic mb-1">
                            "{selectedReq.intencao}"
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[#1E242B] mt-1 space-y-1">
                          <span className="text-[8px] font-bold text-[#94A3B8] uppercase block">Estado Litúrgico Atual:</span>
                          {selectedReq.status === 'Pendente' ? (
                            <div className="text-[10px] text-amber-400 font-bold flex items-center gap-1.5 bg-amber-500/5 p-1 rounded border border-amber-500/10">
                              <Clock className="w-3.5 h-3.5 animate-spin" />
                              <span>Enviado ao terreiro. O Zelador da casa acolherá o pedido em breve.</span>
                            </div>
                          ) : selectedReq.status === 'Aceito' ? (
                            <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-500/5 p-1 rounded border border-emerald-500/10">
                              <Check className="w-3.5 h-3.5" />
                              <span>Vela virtual acendida no Altar Físico! Orações correndo de forma assistida.</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-violet-400 font-black flex items-center gap-1.5 bg-violet-500/5 p-1 rounded border border-violet-500/15 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
                              <span>Corrente Espiritual Ativa no terreiro! Mentalize pensamentos de cura e amparo.</span>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })()}

                {/* Sub-block 3: Live Direct chat with Zelador */}
                {(() => {
                  const selectedReq = prayerRequests.find(r => r.id === publicSelectedId);
                  if (!selectedReq) return null;

                  return (
                    <div className="border border-[#1E242B] rounded-2xl overflow-hidden bg-[#12161A]/85 flex flex-col justify-between max-h-[190px]">
                      
                      {/* Chat Top header */}
                      <div className="px-3 py-1.5 bg-[#12161A] text-[9px] font-black text-[#94A3B8] uppercase border-b border-[#1E242B] flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                          Linha de Contato com o Altar
                        </span>
                        <span className="text-[7.5px] bg-red-950/20 text-rose-400 px-1.5 py-0.5 rounded border border-red-500/10 uppercase font-normal">
                          Chat do Fiel (Privado)
                        </span>
                      </div>

                      {/* Msg Stream */}
                      <div className="flex-grow overflow-y-auto p-3 space-y-2 flex flex-col justify-end min-h-[90px] max-h-[110px]">
                        {selectedReq.chatMessages.map((msg) => {
                          const isZelador = msg.sender === 'Zelador';
                          const isSystem = msg.id.startsWith('m-sys-');
                          
                          if (isSystem) {
                            return (
                              <div key={msg.id} className="text-center my-0.5">
                                <span className="text-[8px] bg-[#1E2530] text-[#FACC15] px-1.5 py-0.5 rounded-full border border-[#1E242B]">
                                  {msg.text}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col max-w-[80%] ${
                                isZelador ? 'align-start self-start items-start' : 'align-end self-end items-end'
                              }`}
                            >
                              <span className="text-[7.5px] text-gray-500 mb-0.5">
                                {isZelador ? 'Zelador (Terreiro)' : 'Você'} • {msg.time}
                              </span>
                              <div
                                className={`p-2 rounded-lg text-[10.5px] leading-tight ${
                                  isZelador
                                    ? 'bg-[#1E2530] text-[#F1F5F9] rounded-tl-none border border-[#1E242B]'
                                    : 'bg-[#FBEFDB] text-[#292523] rounded-tr-none'
                                }`}
                              >
                                {msg.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Chat Input */}
                      <div className="p-1.5 border-t border-[#1E242B] bg-[#12161A] flex gap-1.5 items-center">
                        <input
                          type="text"
                          placeholder="Fale com o Zelador sobre banhos de ervas, preces ou agradecimentos..."
                          value={publicChatInput}
                          onChange={(e) => setPublicChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendPublicChatMessage();
                          }}
                          className="flex-grow text-[11px] px-2.5 py-1.5 rounded-md border border-[#1E242B] bg-[#12161A] text-[#F1F5F9] focus:ring-1 focus:ring-[#FACC15] focus:outline-none placeholder:text-gray-650"
                        />
                        <button
                          onClick={handleSendPublicChatMessage}
                          className="bg-[#10B981] hover:bg-[#059669] text-white px-3 py-1.5 text-[10.5px] font-bold rounded-md transition-all uppercase cursor-pointer"
                        >
                          Enviar
                        </button>
                      </div>

                    </div>
                  );
                })()}

              </div>

              {/* Suggestions / Tip */}
              <div className="mt-4 p-2.5 bg-[#12161A]/60 border border-dashed border-[#1E242B] rounded-xl text-[10px] text-center text-[#94A3B8]">
                💡 <strong>Como testar a Realidade Virtual Integrada:</strong> Envie um pedido de reza acima, depois navegue de volta clicando em <strong>Demo Interativa</strong> no topo da página. Ative a visão do <strong>Zelador</strong> na aba de <strong>Pedidos de Reza</strong> da Demo, visualize e altere o status de seu pedido, e envie mensagens! Toda interação atualizará esta aba e este chat simultaneamente em tempo de execução.
              </div>

            </div>

          </div>

        </div>
      )}

      {/* FOOTER SITE MAP AREA */}
      <footer className="bg-[#07090C] border-t border-[#13171D] py-16 text-[#94A3B8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-10">
          
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1E2530] flex items-center justify-center border border-[#FACC15]/30 shadow-sm">
                <Flame className="w-4 h-4 text-[#FACC15] fill-[#FACC15]/10" />
              </div>
              <span className="font-display font-extrabold text-base text-[#F1F5F9]">
                Axé<span className="text-[#FACC15]">Cloud</span>
              </span>
            </div>
            <p className="text-xs font-light leading-relaxed text-[#94A3B8]">
              Gestão inteligente e segura baseada na nuvem para casas de Axé, Centros e Terreiros de Umbanda e Candomblé no Brasil.
            </p>
          </div>

          <div>
            <h6 className="font-bold text-xs uppercase text-[#F1F5F9] tracking-wider mb-4">Plataforma</h6>
            <ul className="space-y-2 text-xs">
              <li><a href="#plataforma" className="hover:text-[#F1F5F9]">Ficha Litúrgica</a></li>
              <li><a href="#recursos" className="hover:text-[#F1F5F9]">Mensalidades & Caixa</a></li>
              <li><a href="#demonstracao" className="hover:text-[#F1F5F9]">Acervo de Curimba</a></li>
            </ul>
          </div>

          <div>
            <h6 className="font-bold text-xs uppercase text-[#F1F5F9] tracking-wider mb-4">Segurança</h6>
            <ul className="space-y-2 text-xs">
              <li><a href="#seguranca" className="hover:text-[#F1F5F9]">Privacidade de Dados LGPD</a></li>
              <li><a href="#seguranca" className="hover:text-[#F1F5F9]">Protocolo Religioso de Criptografia</a></li>
              <li><a href="#seguranca" className="hover:text-[#F1F5F9]">Backup em Nuvem Redundante</a></li>
            </ul>
          </div>

          <div>
            <h6 className="font-bold text-xs uppercase text-[#F1F5F9] tracking-wider mb-4">Nossa Saudação</h6>
            <p className="text-xs italic leading-relaxed text-[#94A3B8]">
              "Respeitamos todas as manifestações religiosas ancestrais de matriz africana. Que a união e a força dos Orixás iluminem sua jornada de desenvolvimento espiritual. Axé!"
            </p>
          </div>

        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-[#13171D] mt-12 pt-6 text-center text-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Axé Cloud Brasil. Todos os direitos reservados. Feito com extremo respeito às tradições.</p>
          
          <div className="flex gap-4">
            <span className="hover:text-[#F1F5F9] cursor-pointer">Termos de Uso</span>
            <span className="text-[#1E242B]">|</span>
            <span className="hover:text-[#F1F5F9] cursor-pointer font-bold text-[#FACC15]">Respeito Legal</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
