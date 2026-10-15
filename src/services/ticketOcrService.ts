import { LotteryType } from '../types';

export interface ScannedGame {
  label: string;
  numbersCount: number;
  numbers: number[];
  cost?: number;
}

export interface OcrTicketResult {
  lotteryType: LotteryType;
  contestNumber?: string;
  drawDate?: string;
  totalAmount?: number;
  games: ScannedGame[];
  rawText?: string;
  confidenceNotes?: string;
}

export interface OcrApiResponse {
  success: boolean;
  source?: 'gemini-vision' | 'fallback-parser';
  warning?: string;
  error?: string;
  data?: OcrTicketResult;
}

/**
 * Sends a base64 encoded image of a Caixa lottery ticket to the server OCR endpoint.
 */
export async function scanTicketWithAI(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  defaultLottery: LotteryType = 'mega-sena'
): Promise<OcrApiResponse> {
  try {
    const response = await fetch('/api/ocr-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        defaultLottery,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Erro na comunicação com servidor (${response.status})`);
    }

    const data: OcrApiResponse = await response.json();
    return data;
  } catch (error: any) {
    console.error('Scan Ticket Error:', error);
    return {
      success: false,
      error: error?.message || 'Falha ao processar a imagem do bilhete.',
    };
  }
}

/**
 * Cleans and normalizes numbers string into sorted unique integer array
 */
export function parseTicketNumbersText(rawText: string, min = 1, max = 60): number[] {
  const matches = rawText.match(/\d+/g);
  if (!matches) return [];

  const unique = new Set<number>();
  for (const m of matches) {
    const n = parseInt(m, 10);
    if (n >= min && n <= max) {
      unique.add(n);
    }
  }

  return Array.from(unique).sort((a, b) => a - b);
}
