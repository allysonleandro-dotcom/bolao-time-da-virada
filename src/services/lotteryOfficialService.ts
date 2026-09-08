export interface OfficialLotteryResult {
  success: boolean;
  lotteryType: string;
  contestNumber: string;
  drawDate?: string;
  drawnNumbers: number[];
  acumulou?: boolean;
  premiacoes?: Array<{
    faixa?: string;
    descricaoFaixa?: string;
    faixaDescricao?: string;
    ganhadores?: number;
    numeroDeGanhadores?: number;
    valorPremio?: number;
    valor?: number;
  }>;
  error?: string;
}

/**
 * Busca o resultado oficial de uma loteria da Caixa via API
 */
export async function fetchOfficialLotteryResult(
  lotteryType: string,
  contest?: string
): Promise<OfficialLotteryResult> {
  const contestParam = contest?.trim() ? encodeURIComponent(contest.trim()) : 'latest';
  const url = `/api/lottery-result?lottery=${encodeURIComponent(lotteryType)}&contest=${contestParam}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Erro HTTP ${res.status} ao consultar resultado.`);
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('Erro ao consultar API local de loterias, tentando fallback público:', err);

    // Fallback público direto se o proxy local falhar
    try {
      const modalityMap: Record<string, string> = {
        'mega-sena': 'megasena',
        megasena: 'megasena',
        lotofacil: 'lotofacil',
        quina: 'quina',
        lotomania: 'lotomania',
        'dupla-sena': 'duplasena',
        timemania: 'timemania',
        'dia-de-sorte': 'diadesorte',
        milionaria: 'maismilionaria',
      };
      const slug = modalityMap[lotteryType] || 'lotofacil';
      const fallbackContest = contest?.trim() || 'latest';
      const fallbackRes = await fetch(`https://loteriascaixa-api.herokuapp.com/api/${slug}/${fallbackContest}`);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const dezenasRaw = fallbackData.dezenas || fallbackData.listaDezenas || [];
        return {
          success: true,
          lotteryType,
          contestNumber: String(fallbackData.concurso || fallbackData.numero || contest),
          drawDate: fallbackData.data || fallbackData.dataApuracao || '',
          drawnNumbers: dezenasRaw.map((n: any) => Number(n)).sort((a: number, b: number) => a - b),
          acumulou: fallbackData.acumulou ?? false,
          premiacoes: fallbackData.premiacoes || [],
        };
      }
    } catch (fallbackErr) {
      console.error('Fallback público também falhou:', fallbackErr);
    }

    throw new Error(err.message || 'Não foi possível carregar o resultado oficial.');
  }
}
