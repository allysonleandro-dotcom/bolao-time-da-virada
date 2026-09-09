import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bolao, Participant, TicketGame } from '../types';
import {
  extractNameAndPhone,
  formatCurrency,
  formatNumbersList,
  getParticipantQuotaLabel,
  formatDateLongBR,
  generateDefaultStructureText,
  generateDefaultDeclarationText,
  getLotteryDisplayName,
} from './calculator';

// Helper to format date in Brazilian standard
export function formatDateBR(dateStr?: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * 1. Export Conference & Draw Results for a Bolão as PDF
 */
export function exportBolaoConferencePDF(
  bolao: Bolao,
  allParticipants: Participant[],
  drawnNumbers?: number[],
  prizeBreakdown?: { tier: string; hits: number; count: number; totalPrize: number }[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const effectiveDrawn = drawnNumbers || bolao.drawnNumbers || [];
  const primaryColor = [5, 150, 105]; // Emerald-600

  // Title Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('BOLÃO TIME DA VIRADA - CONFERÊNCIA OFICIAL', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
    14,
    20
  );

  // Bolão Information Box
  let startY = 36;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, startY, 182, 30, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(bolao.title, 18, startY + 8);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Loteria: ${bolao.lotteryType.toUpperCase()}`, 18, startY + 16);
  doc.text(`Concurso: ${bolao.contestNumber || 'N/A'}`, 75, startY + 16);
  doc.text(`Data do Sorteio: ${formatDateBR(bolao.drawDate)}`, 130, startY + 16);

  doc.text(`Total de Cotas: ${bolao.totalQuotas}`, 18, startY + 24);
  doc.text(`Valor por Cota: ${formatCurrency(bolao.quotaPrice)}`, 75, startY + 24);
  doc.text(
    `Arrecadação Total: ${formatCurrency(bolao.totalQuotas * bolao.quotaPrice)}`,
    130,
    startY + 24
  );

  // Drawn Numbers Box
  startY += 36;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, startY, 182, 20, 2, 2, 'FD');

  doc.setTextColor(6, 95, 70);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DEZENAS SORTEADAS (OFICIAL CAIXA):', 18, startY + 7);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const drawnStr =
    effectiveDrawn.length > 0
      ? effectiveDrawn.map((n) => n.toString().padStart(2, '0')).join(' - ')
      : 'Aguardando divulgação do resultado da Caixa';
  doc.text(drawnStr, 18, startY + 14);

  // Ticket Table
  startY += 26;
  const ticketRows = bolao.tickets.map((ticket, index) => {
    const hitsCount = ticket.numbers.filter((n) => effectiveDrawn.includes(n)).length;
    const sortedNums = [...ticket.numbers].sort((a, b) => a - b);
    const numsStr = sortedNums
      .map((n) => {
        const str = n.toString().padStart(2, '0');
        return effectiveDrawn.includes(n) ? `[${str}]` : str;
      })
      .join(' ');

    return [
      `Jogo #${index + 1} (${ticket.numbersCount} dezenas)`,
      numsStr,
      effectiveDrawn.length > 0 ? `${hitsCount} acertos` : '-',
      formatCurrency(ticket.prizeWonAmount || 0),
    ];
  });

  autoTable(doc, {
    startY: startY,
    head: [['Identificação', 'Dezenas Jogadas ([ ] = Acerto)', 'Acertos', 'Prêmio']],
    body: ticketRows,
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 90 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
    },
  });

  // Summary / Participants Section
  const finalY = (doc as any).lastAutoTable?.finalY || 160;

  // Participant list with share
  const partMap = new Map(allParticipants.map((p) => [p.id, p]));
  const totalPrize = bolao.totalPrizeWon || 0;
  const prizePerQuota = bolao.totalQuotas > 0 ? totalPrize / bolao.totalQuotas : 0;

  // Ordenar participantes pelo número da cota em ordem crescente
  const sortedParticipants = [...bolao.participants].sort((a, b) => {
    const aFirst = Number(a.quotaNumbers?.[0] ?? 999);
    const bFirst = Number(b.quotaNumbers?.[0] ?? 999);
    return aFirst - bFirst;
  });

  const participantRows = sortedParticipants.map((bp) => {
    const p = partMap.get(bp.participantId);
    let rawName = p?.name || '';
    let rawPhone = p?.phone || '';
    if (!rawName && bp.participantId) {
      rawName = bp.participantId.replace(/^part-/, '');
    }
    const contact = extractNameAndPhone(rawName, rawPhone);
    const name = (contact.cleanName || 'COTA NÃO IDENTIFICADA').toUpperCase();
    const phone = contact.formattedPhone || '-';
    const quotaPrize = bp.quotas * prizePerQuota;
    const quotaLabel = getParticipantQuotaLabel(bolao, bp.participantId, bp);
    return [
      name,
      phone,
      quotaLabel,
      bp.status === 'pago' ? 'PAGO' : 'PENDENTE',
      formatCurrency(bp.amountPaid),
      totalPrize > 0 ? formatCurrency(quotaPrize) : '-',
    ];
  });

  // Cotas disponíveis não preenchidas (ex: cotas 48 a 50)
  const assignedQuotaNumbers = new Set<number>();
  bolao.participants.forEach((bp) => {
    bp.quotaNumbers?.forEach((qn) => assignedQuotaNumbers.add(Number(qn)));
  });

  const totalQuotasNum = Number(bolao.totalQuotas) || 0;
  if (totalQuotasNum > assignedQuotaNumbers.size) {
    for (let q = 1; q <= totalQuotasNum; q++) {
      if (!assignedQuotaNumbers.has(q)) {
        participantRows.push([
          `[ COTA ${q} DISPONÍVEL ]`,
          '-',
          `Cota ${q}`,
          'DISPONÍVEL',
          'R$ 0,00',
          '-',
        ]);
      }
    }
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('LISTA DE PARTICIPANTES & RATEIO:', 14, finalY + 10);

  autoTable(doc, {
    startY: finalY + 14,
    head: [['Participante', 'Contato', 'Nº da Cota', 'Status', 'Valor Pago', 'Rateio Prêmio']],
    body: participantRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 35 },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
    },
  });

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Bolão Time da Virada • Página ${i} de ${pageCount} • Documento gerado para controle e prestação de contas.`,
      105,
      290,
      { align: 'center' }
    );
  }

  const cleanTitle = bolao.title.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Conferencia_${cleanTitle}_Conc_${bolao.contestNumber || 'Geral'}.pdf`);
}

/**
 * 2. Export Bolões History / Archive as PDF
 */
export function exportBoloesHistoryPDF(boloes: Bolao[]) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('HISTÓRICO COMPLETO DE REGISTRO DE BOLÕES', 14, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Relatório emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} • Total de Bolões: ${boloes.length}`,
    14,
    18
  );

  // Summary Metrics Bar
  const totalArrecadado = boloes.reduce(
    (acc, b) => acc + b.participants.reduce((sum, p) => sum + (p.amountPaid || 0), 0),
    0
  );
  const totalPremios = boloes.reduce((acc, b) => acc + (b.totalPrizeWon || 0), 0);
  const totalCotas = boloes.reduce((acc, b) => acc + b.totalQuotas, 0);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 28, 269, 16, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('RESUMO GERAL ACUMULADO:', 18, 38);

  doc.setTextColor(15, 23, 42);
  doc.text(`Total Arrecadado: ${formatCurrency(totalArrecadado)}`, 80, 38);
  doc.text(`Total em Prêmios: ${formatCurrency(totalPremios)}`, 145, 38);
  doc.text(`Cotas Totais Criadas: ${totalCotas}`, 215, 38);

  // Bolão Table
  const rows = boloes.map((b, idx) => {
    const arrecadado = b.participants.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const cotasPagas = b.participants.filter((p) => p.status === 'pago').reduce((s, p) => s + p.quotas, 0);
    const premio = b.totalPrizeWon || 0;
    const statusLabels: Record<string, string> = {
      rascunho: 'Rascunho',
      arrecadando: 'Arrecadando',
      jogos_registrados: 'Registrado',
      aguardando_sorteio: 'Aguard. Sorteio',
      conferido: 'Conferido',
      premiado: 'PREMIADO',
      finalizado: 'Finalizado',
    };

    return [
      `#${idx + 1}`,
      b.title,
      b.lotteryType.toUpperCase(),
      b.contestNumber || '-',
      formatDateBR(b.drawDate),
      `${cotasPagas}/${b.totalQuotas}`,
      formatCurrency(b.quotaPrice),
      formatCurrency(arrecadado),
      premio > 0 ? formatCurrency(premio) : '-',
      statusLabels[b.status] || b.status,
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [
      [
        'Item',
        'Nome do Bolão',
        'Loteria',
        'Concurso',
        'Data Sorteio',
        'Cotas (Pagas/Tot)',
        'Valor Cota',
        'Total Arrecadado',
        'Prêmio Ganho',
        'Status',
      ],
    ],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 65 },
      2: { cellWidth: 25 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 25, halign: 'center' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 28, halign: 'right' },
      8: { cellWidth: 25, halign: 'right' },
      9: { cellWidth: 22, halign: 'center' },
    },
  });

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Bolão Time da Virada • Relatório de Histórico • Página ${i} de ${pageCount}`,
      148,
      202,
      { align: 'center' }
    );
  }

  doc.save(`Historico_Boloes_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * 3. Export Participant Spending & Monthly Average Report as PDF
 */
export function exportParticipantsSpendingReportPDF(
  participants: Participant[],
  boloes: Bolao[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO FINANCEIRO POR PARTICIPANTE & MÉDIA MENSAL', 14, 11);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Extrato Consolidado • Data: ${new Date().toLocaleDateString('pt-BR')} • Total de Participantes: ${participants.length}`,
    14,
    19
  );

  // Compute stats for each participant
  let totalInvestidoGeral = 0;
  let totalPremiosGeral = 0;
  let totalCotasGeral = 0;

  const rows = participants.map((p, idx) => {
    let totalInvestido = 0;
    let totalCotas = 0;
    let totalPremios = 0;
    let bolaoCount = 0;

    // Dates for monthly average calculation
    const participantDates: Date[] = [];

    boloes.forEach((b) => {
      const entry = b.participants.find((bp) => bp.participantId === p.id);
      if (entry) {
        bolaoCount += 1;
        totalCotas += entry.quotas;
        totalInvestido += entry.amountPaid || 0;
        if (entry.paidAt) {
          participantDates.push(new Date(entry.paidAt));
        } else if (b.drawDate) {
          participantDates.push(new Date(b.drawDate));
        }

        if (b.totalPrizeWon && b.totalPrizeWon > 0 && b.totalQuotas > 0) {
          const quotaShare = b.totalPrizeWon / b.totalQuotas;
          totalPremios += entry.quotas * quotaShare;
        }
      }
    });

    totalInvestidoGeral += totalInvestido;
    totalPremiosGeral += totalPremios;
    totalCotasGeral += totalCotas;

    // Calculate active months
    let monthsActive = 1;
    if (participantDates.length > 1) {
      const minDate = new Date(Math.min(...participantDates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...participantDates.map((d) => d.getTime())));
      const diffMonths =
        (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
        (maxDate.getMonth() - minDate.getMonth()) +
        1;
      monthsActive = Math.max(1, diffMonths);
    }
    const mediaMensal = totalInvestido / monthsActive;
    const saldoLiquido = totalPremios - totalInvestido;

    const contact = extractNameAndPhone(p.name, p.phone);
    return [
      `#${idx + 1}`,
      contact.cleanName.toUpperCase(),
      contact.formattedPhone || '-',
      `${totalCotas} cotas (${bolaoCount} bolões)`,
      formatCurrency(totalInvestido),
      `${formatCurrency(mediaMensal)}/mês`,
      formatCurrency(totalPremios),
      saldoLiquido >= 0 ? `+${formatCurrency(saldoLiquido)}` : formatCurrency(saldoLiquido),
    ];
  });

  // Summary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 30, 182, 16, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAIS CONSOLIDADOS:', 18, 37);

  doc.setTextColor(15, 23, 42);
  doc.text(`Total Gasto: ${formatCurrency(totalInvestidoGeral)}`, 18, 43);
  doc.text(`Cotas Totais: ${totalCotasGeral}`, 80, 43);
  doc.text(`Prêmios Distribuídos: ${formatCurrency(totalPremiosGeral)}`, 125, 43);

  autoTable(doc, {
    startY: 50,
    head: [
      [
        '#',
        'Nome do Participante',
        'Telefone',
        'Participação',
        'Total Gasto',
        'Média Mensal',
        'Prêmios',
        'Saldo Líq.',
      ],
    ],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 42 },
      2: { cellWidth: 26 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 20, halign: 'right' },
    },
  });

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Bolão Time da Virada • Relatório Financeiro e Médias • Página ${i} de ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
  }

  doc.save(`Extrato_Financeiro_Participantes_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * 4. Export Individual Participant Statement as PDF
 */
export function exportSingleParticipantStatementPDF(
  participant: Participant,
  boloes: Bolao[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('EXTRATO INDIVIDUAL DO PARTICIPANTE', 14, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 19);

  // Participant Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 30, 182, 24, 2, 2, 'FD');

  const partContact = extractNameAndPhone(participant.name, participant.phone);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(partContact.cleanName.toUpperCase(), 18, 38);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Telefone: ${partContact.formattedPhone || 'Não informado'}`, 18, 46);
  doc.text(`Chave Pix: ${participant.pixKey || 'Não informada'}`, 80, 46);
  doc.text(`Membro desde: ${formatDateBR(participant.createdAt)}`, 140, 46);

  // Calculate bolão participations
  const participations: {
    bolaoTitle: string;
    lottery: string;
    contest: string;
    date: string;
    quotaLabel: string;
    quotas: number;
    amountPaid: number;
    status: string;
    prizeWon: number;
  }[] = [];

  let totalSpent = 0;
  let totalPrize = 0;
  let totalQuotas = 0;
  const dates: Date[] = [];

  boloes.forEach((b) => {
    const entry = b.participants.find((bp) => bp.participantId === participant.id);
    if (entry) {
      totalSpent += entry.amountPaid || 0;
      totalQuotas += entry.quotas;
      if (entry.paidAt) dates.push(new Date(entry.paidAt));
      else if (b.drawDate) dates.push(new Date(b.drawDate));

      let share = 0;
      if (b.totalPrizeWon && b.totalPrizeWon > 0 && b.totalQuotas > 0) {
        share = (b.totalPrizeWon / b.totalQuotas) * entry.quotas;
        totalPrize += share;
      }

      participations.push({
        bolaoTitle: b.title,
        lottery: b.lotteryType.toUpperCase(),
        contest: b.contestNumber || '-',
        date: formatDateBR(b.drawDate),
        quotaLabel: getParticipantQuotaLabel(b, entry.participantId, entry),
        quotas: entry.quotas,
        amountPaid: entry.amountPaid || 0,
        status: entry.status === 'pago' ? 'PAGO' : 'PENDENTE',
        prizeWon: share,
      });
    }
  });

  let months = 1;
  if (dates.length > 1) {
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    const diff =
      (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
      (maxDate.getMonth() - minDate.getMonth()) +
      1;
    months = Math.max(1, diff);
  }
  const monthlyAvg = totalSpent / months;
  const netBalance = totalPrize - totalSpent;

  // Financial Stats Box
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, 58, 182, 18, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70);
  doc.text(`Total Gasto: ${formatCurrency(totalSpent)}`, 18, 66);
  doc.text(`Média Mensal: ${formatCurrency(monthlyAvg)}/mês`, 65, 66);
  doc.text(`Prêmios Recebidos: ${formatCurrency(totalPrize)}`, 115, 66);
  doc.text(`Saldo: ${netBalance >= 0 ? '+' : ''}${formatCurrency(netBalance)}`, 160, 66);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total de Cotas: ${totalQuotas} em ${participations.length} bolão(ões)`, 18, 72);

  // Table of Participations
  const rows = participations.map((p) => [
    p.bolaoTitle,
    p.lottery,
    p.contest,
    p.date,
    p.quotaLabel,
    formatCurrency(p.amountPaid),
    p.status,
    p.prizeWon > 0 ? formatCurrency(p.prizeWon) : '-',
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['Bolão', 'Loteria', 'Concurso', 'Data', 'Nº da Cota', 'Valor Pago', 'Status', 'Prêmio']],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 20 },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 17, halign: 'right' },
    },
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Bolão Time da Virada • Extrato do Participante • Página ${i} de ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
  }

  const cleanName = participant.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Extrato_${cleanName}.pdf`);
}

/**
 * 6. Export Generated Guess Tickets for Caixa Lotteries as PDF
 */
export interface GeneratedTicketPDFItem {
  id: string;
  name?: string;
  numbers: number[];
  numbersCount: number;
  cost: number;
  specialValue?: string; // Team, Month, Trevos, etc.
}

export function exportGeneratedTicketsPDF(params: {
  lotteryType: string;
  lotteryName: string;
  numbersCount: number;
  tickets: GeneratedTicketPDFItem[];
  totalCost: number;
  totalCombinations: number;
  strategyName?: string;
  fixedNumbers?: number[];
  excludedNumbers?: number[];
  title?: string;
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const {
    lotteryName,
    numbersCount,
    tickets,
    totalCost,
    totalCombinations,
    strategyName = 'Surpresinha Balanceada',
    fixedNumbers = [],
    excludedNumbers = [],
    title = 'PALPITES & JOGOS OFICIAIS GERADOS',
  } = params;

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 210, 26, 'F');

  // Accent line
  doc.setFillColor(5, 150, 105); // Emerald-600
  doc.rect(0, 26, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`BOLÃO TIME DA VIRADA • ${lotteryName.toUpperCase()}`, 14, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(
    `${title} • Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    14,
    19
  );

  // Summary Metrics Box
  let startY = 34;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, startY, 182, 30, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Resumo dos Jogos Gerados — ${lotteryName}`, 18, startY + 7);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Modalidade: ${lotteryName}`, 18, startY + 15);
  doc.text(`Dezenas por Volante: ${numbersCount} dezenas`, 75, startY + 15);
  doc.text(`Total de Jogos: ${tickets.length} bilhete(s)`, 140, startY + 15);

  doc.text(`Estratégia: ${strategyName}`, 18, startY + 23);
  doc.text(`Equivalência: ${totalCombinations} apostas simples`, 75, startY + 23);
  doc.setTextColor(5, 150, 105);
  doc.setFont('helvetica', 'bold');
  doc.text(`Custo Total Caixa: ${formatCurrency(totalCost)}`, 140, startY + 23);

  // Filters Box (if fixed or excluded numbers exist)
  if (fixedNumbers.length > 0 || excludedNumbers.length > 0) {
    startY += 34;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(14, startY, 182, 14, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');

    let filterText = '';
    if (fixedNumbers.length > 0) {
      filterText += `Dezenas Fixas: ${fixedNumbers.map((n) => n.toString().padStart(2, '0')).join(', ')}   `;
    }
    if (excludedNumbers.length > 0) {
      filterText += `Dezenas Excluídas: ${excludedNumbers.map((n) => n.toString().padStart(2, '0')).join(', ')}`;
    }
    doc.text(filterText, 18, startY + 8);
    startY += 18;
  } else {
    startY += 34;
  }

  // Tickets Table Rows
  const rows = tickets.map((t, idx) => {
    const sorted = [...t.numbers].sort((a, b) => a - b);
    const numsStr = sorted.map((n) => n.toString().padStart(2, '0')).join(' - ');
    const evens = sorted.filter((n) => n % 2 === 0).length;
    const odds = sorted.length - evens;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return [
      `Jogo #${(idx + 1).toString().padStart(2, '0')}`,
      numsStr,
      t.specialValue || `${evens}P / ${odds}I (Soma: ${sum})`,
      formatCurrency(t.cost),
    ];
  });

  autoTable(doc, {
    startY: startY,
    head: [['Identificação', 'Dezenas Marcadas no Volante', 'Info / Balanço', 'Valor Oficial']],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold' },
      1: { cellWidth: 100, fontStyle: 'bold' },
      2: { cellWidth: 36, halign: 'center' },
      3: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
  });

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Bolão Time da Virada • Gerador Oficial de Palpites • Página ${i} de ${pageCount} • Registre suas apostas na Rede Lotérica Oficial da Caixa`,
      105,
      290,
      { align: 'center' }
    );
  }

  const cleanLottery = lotteryName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Palpites_${cleanLottery}_${tickets.length}jogos.pdf`);
}

/**
 * 6. Export "Recebimento de cota de loteria" - Signature & Quota Receipt Document
 */
export interface ExportQuotaReceiptsOptions {
  bolao: Bolao;
  allParticipants: Participant[];
  structureText?: string;
  declarationText?: string;
  estimatedPrize?: string;
  lotteryName?: string;
  contestNumber?: string;
  drawDateFormatted?: string;
  organizerName?: string;
  groupByQuota?: boolean; // default true: each cota (1..N) gets its own numbered row
  includeAvailableQuotas?: boolean; // default true: blank rows for unassigned quotas so paper sheet has full cota slots
  showSignatureLine?: boolean; // default false: clean open box for handwriting signature
}

export function exportBolaoQuotaReceiptsPDF(options: ExportQuotaReceiptsOptions) {
  const {
    bolao,
    allParticipants,
    groupByQuota = true,
    includeAvailableQuotas = true,
    showSignatureLine = false,
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const lotteryName = options.lotteryName || getLotteryDisplayName(bolao);
  const contestNumber = options.contestNumber || bolao.contestNumber || 'N/A';
  const drawDateFormatted = options.drawDateFormatted || formatDateLongBR(bolao.drawDate);
  const estimatedPrize =
    options.estimatedPrize ||
    (typeof bolao.estimatedPrize === 'string' && bolao.estimatedPrize
      ? bolao.estimatedPrize
      : typeof bolao.estimatedPrize === 'number' && bolao.estimatedPrize > 0
      ? formatCurrency(bolao.estimatedPrize)
      : bolao.title.toLowerCase().includes('independência') || bolao.title.toLowerCase().includes('independencia')
      ? 'R$ 300 milhões'
      : bolao.title.toLowerCase().includes('virada')
      ? 'R$ 600 milhões'
      : 'R$ 300 milhões');

  const structureText = options.structureText || generateDefaultStructureText(bolao);
  const declarationText =
    options.declarationText ||
    generateDefaultDeclarationText({
      lotteryName,
      contestNumber,
      estimatedPrize,
      drawDateFormatted,
    });

  const organizerName = options.organizerName || bolao.organizerName || 'Organizador do Bolão';

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEBIMENTO DE COTA DE LOTERIA', 105, 11, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(
    `${bolao.title} • Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    105,
    18,
    { align: 'center' }
  );

  let currentY = 30;

  // Box da Declaração Oficial
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.roundedRect(14, currentY, 182, 34, 2, 2, 'FD');

  // Estrutura de Aposta
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text('Estrutura de Aposta:', 18, currentY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(structureText, 52, currentY + 6.5);

  // Declaração principal
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Declaração:', 18, currentY + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const splitDeclaration = doc.splitTextToSize(declarationText, 172);
  doc.text(splitDeclaration, 18, currentY + 18.5);

  // Informações Rápidas no Rodapé da Caixa de Declaração
  doc.setDrawColor(226, 232, 240);
  doc.line(18, currentY + 27, 192, currentY + 27);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total de Cotas: ${bolao.totalQuotas}`, 18, currentY + 31.5);
  doc.text(`Valor por Cota: ${formatCurrency(bolao.quotaPrice)}`, 68, currentY + 31.5);
  doc.text(`Sorteio: ${drawDateFormatted}`, 115, currentY + 31.5);
  doc.text(`Organizador: ${organizerName}`, 162, currentY + 31.5);

  currentY += 39;

  // Build table data
  const partMap = new Map<string, Participant>(allParticipants.map((p) => [p.id, p]));
  const totalQuotasNum = Number(bolao.totalQuotas) || 0;
  const currentYear = new Date().getFullYear();
  const datePlaceholder = `___/___/${currentYear}`;

  let tableRows: string[][] = [];

  if (groupByQuota && totalQuotasNum > 0) {
    // Map each quota number (1 to totalQuotas) to participant
    const quotaToParticipant = new Map<number, { name: string; phone: string; status: string }>();

    bolao.participants.forEach((bp) => {
      const p = partMap.get(bp.participantId);
      let rawName = p?.name || '';
      let rawPhone = p?.phone || '';
      if (!rawName && bp.participantId) {
        rawName = bp.participantId.replace(/^part-/, '');
      }
      const contact = extractNameAndPhone(rawName, rawPhone);
      const cleanName = (contact.cleanName || 'COTA NÃO IDENTIFICADA').toUpperCase();
      const phone = contact.formattedPhone || '-';

      if (bp.quotaNumbers && bp.quotaNumbers.length > 0) {
        bp.quotaNumbers.forEach((qn) => {
          const num = Number(qn);
          if (!isNaN(num)) {
            quotaToParticipant.set(num, { name: cleanName, phone, status: bp.status });
          }
        });
      }
    });

    for (let q = 1; q <= totalQuotasNum; q++) {
      const assigned = quotaToParticipant.get(q);
      const cotaStr = `Cota ${String(q).padStart(2, '0')}`;
      if (assigned) {
        tableRows.push([
          cotaStr,
          assigned.name,
          datePlaceholder,
          '', // Signature blank space
        ]);
      } else if (includeAvailableQuotas) {
        tableRows.push([
          cotaStr,
          'COTA DISPONÍVEL',
          datePlaceholder,
          '',
        ]);
      }
    }
  } else {
    // Grouped by participant
    const sortedParticipants = [...bolao.participants].sort((a, b) => {
      const aFirst = Number(a.quotaNumbers?.[0] ?? 999);
      const bFirst = Number(b.quotaNumbers?.[0] ?? 999);
      return aFirst - bFirst;
    });

    sortedParticipants.forEach((bp) => {
      const p = partMap.get(bp.participantId);
      let rawName = p?.name || '';
      let rawPhone = p?.phone || '';
      if (!rawName && bp.participantId) {
        rawName = bp.participantId.replace(/^part-/, '');
      }
      const contact = extractNameAndPhone(rawName, rawPhone);
      const cleanName = (contact.cleanName || 'COTA NÃO IDENTIFICADA').toUpperCase();
      const quotaLabel = getParticipantQuotaLabel(bolao, bp.participantId, bp);

      tableRows.push([
        quotaLabel,
        cleanName,
        datePlaceholder,
        '',
      ]);
    });
  }

  // Generate AutoTable
  autoTable(doc, {
    startY: currentY,
    head: [['Cota', 'Nome do Participante', 'Data', 'Assinatura do Participante']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // Slate-900
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: { top: 3.5, bottom: 3.5, left: 2.5, right: 2.5 },
      minCellHeight: 11, // ample room for signing with a pen
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 60, fontStyle: 'bold' },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 78, halign: 'center' },
    },
    didDrawCell: (data) => {
      // Draw signature line only if explicitly requested; default is clean open box
      if (showSignatureLine && data.section === 'body' && data.column.index === 3) {
        const x1 = data.cell.x + 3;
        const x2 = data.cell.x + data.cell.width - 3;
        const y = data.cell.y + data.cell.height / 2;
        doc.setDrawColor(160, 174, 192); // Gray line
        doc.setLineWidth(0.2);
        if (typeof (doc as any).setLineDashPattern === 'function') {
          (doc as any).setLineDashPattern([1, 1], 0);
          doc.line(x1, y, x2, y);
          (doc as any).setLineDashPattern([], 0);
        } else {
          doc.line(x1, y, x2, y);
        }
      }
    },
  });

  // Organizer signature section on the last page
  const finalY = (doc as any).lastAutoTable?.finalY || 230;
  const pageHeight = doc.internal.pageSize.getHeight();

  // If near the page bottom, add a new page for closing signatures
  if (finalY > pageHeight - 35) {
    doc.addPage();
  }

  const closingY = finalY > pageHeight - 35 ? 30 : finalY + 12;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Termo: O signatário atesta ter recebido a respectiva cota/comprovante digital e manifesta plena ciência das regras e rateio do bolão.',
    14,
    closingY
  );

  doc.setDrawColor(148, 163, 184);
  doc.line(14, closingY + 16, 85, closingY + 16);
  doc.line(115, closingY + 16, 195, closingY + 16);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Local e Data', 49, closingY + 20, { align: 'center' });
  doc.text(`${organizerName} (Organizador)`, 155, closingY + 20, { align: 'center' });

  // Page numbering and footer
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Recebimento de Cota de Loteria • ${bolao.title} • Página ${i} de ${totalPages}`,
      105,
      290,
      { align: 'center' }
    );
  }

  const cleanTitle = (bolao.title || 'Bolao').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Recebimento_Cotas_${cleanTitle}.pdf`);
}


