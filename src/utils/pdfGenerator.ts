import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bolao, Participant, TicketGame } from '../types';
import { formatCurrency, formatNumbersList } from './calculator';

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

  const participantRows = bolao.participants.map((bp) => {
    const p = partMap.get(bp.participantId);
    const name = p?.name || 'Cota não identificada';
    const quotaPrize = bp.quotas * prizePerQuota;
    return [
      name,
      p?.phone || '-',
      `${bp.quotas} cota(s)`,
      bp.status === 'pago' ? 'PAGO' : 'PENDENTE',
      formatCurrency(bp.amountPaid),
      totalPrize > 0 ? formatCurrency(quotaPrize) : '-',
    ];
  });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('LISTA DE PARTICIPANTES & RATEIO:', 14, finalY + 10);

  autoTable(doc, {
    startY: finalY + 14,
    head: [['Participante', 'Contato', 'Cotas', 'Status', 'Valor Pago', 'Rateio Prêmio']],
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
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
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

    return [
      `#${idx + 1}`,
      p.name,
      p.phone || '-',
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

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(participant.name, 18, 38);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Telefone: ${participant.phone || 'Não informado'}`, 18, 46);
  doc.text(`Chave Pix: ${participant.pixKey || 'Não informada'}`, 80, 46);
  doc.text(`Membro desde: ${formatDateBR(participant.createdAt)}`, 140, 46);

  // Calculate bolão participations
  const participations: {
    bolaoTitle: string;
    lottery: string;
    contest: string;
    date: string;
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
    `${p.quotas} cota(s)`,
    formatCurrency(p.amountPaid),
    p.status,
    p.prizeWon > 0 ? formatCurrency(p.prizeWon) : '-',
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['Bolão', 'Loteria', 'Concurso', 'Data', 'Cotas', 'Valor Pago', 'Status', 'Prêmio']],
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
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 19, halign: 'right' },
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
