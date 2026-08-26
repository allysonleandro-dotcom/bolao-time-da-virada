export type LotteryType =
  | 'mega-sena'
  | 'lotofacil'
  | 'quina'
  | 'lotomania'
  | 'dupla-sena'
  | 'dia-de-sorte'
  | 'timemania'
  | 'super-sete'
  | 'milionaria'
  | 'personalizado';

export interface LotteryRuleTier {
  hits: number | string;
  name: string;
  badgeColor?: string;
}

export interface LotteryPriceEntry {
  numbersCount: number;
  label?: string;
  price: number;
  combinations: number;
}

export interface LotteryConfig {
  id: LotteryType;
  name: string;
  color: string;
  bgLight: string;
  borderClass: string;
  minNumbers: number;
  maxNumbers: number;
  standardBetCount: number;
  totalRange: number; // e.g. 60 for Mega-sena, 25 for Lotofácil
  basePrice: number;
  drawDays: string[];
  priceTable: LotteryPriceEntry[];
  prizeTiers: LotteryRuleTier[];
}

export interface Participant {
  id: string;
  name: string;
  phone: string;
  pixKey?: string;
  pixKeyType?: 'cpf' | 'email' | 'telefone' | 'aleatoria' | 'outro';
  email?: string;
  notes?: string;
  createdAt: string;
}

export type PaymentStatus = 'pago' | 'pendente' | 'parcial' | 'cancelado';
export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | 'outro';

export interface BolaoParticipant {
  participantId: string;
  quotas: number; // Support 1, 0.5, 2, etc.
  quotaNumbers?: (number | string)[]; // e.g. [1] or [1, 2] or ['01']
  status: PaymentStatus;
  amountPaid: number;
  totalDue: number;
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface TicketGame {
  id: string;
  name?: string;
  numbersCount: number;
  numbers: number[];
  cost: number;
  hits?: number[]; // Matches found after draw
  prizeTierWon?: string;
  prizeWonAmount?: number;
}

export interface DigitalReceipt {
  id: string;
  title: string;
  url: string; // base64 data url or image link
  uploadedAt: string;
  fileSize?: string;
  notes?: string;
}

export type BolaoStatus =
  | 'rascunho'
  | 'arrecadando'
  | 'jogos_registrados'
  | 'aguardando_sorteio'
  | 'conferido'
  | 'premiado'
  | 'finalizado';

export interface Bolao {
  id: string;
  title: string;
  lotteryType: LotteryType;
  contestNumber: string; // e.g. "2780"
  drawDate: string; // YYYY-MM-DD
  totalQuotas: number;
  quotaPrice: number;
  adminFeePercent: number; // e.g. 0% or 10%
  adminFeeFixed: number;
  extraCost: number; // other costs like prints, transport, etc.
  reserveFundAmount: number; // fundo de reserva
  pixKeyRecipient?: string;
  pixKeyType?: string;
  organizerName?: string;
  notes?: string;
  status: BolaoStatus;
  
  // Games/Tickets registered
  tickets: TicketGame[];
  
  // Digitalized lottery receipts & photos
  digitalReceipts?: DigitalReceipt[];
  
  // Participants in this bolão
  participants: BolaoParticipant[];
  
  // Draw Result & Checking
  drawnNumbers?: number[];
  isDrawn?: boolean;
  totalPrizeWon?: number;
  netPrizePerQuota?: number;
  
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettings {
  defaultOrganizerName: string;
  defaultPixKey: string;
  defaultPixKeyType: string;
  defaultAdminFeePercent: number;
}
