import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { PublicTicketDTO } from '../shared/types';

export function buildTicketVerifyUrl(ticket: PublicTicketDTO): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const token = ticket.verificationToken ?? '';
  return `${origin}/verify?t=${encodeURIComponent(ticket.id)}&k=${encodeURIComponent(token)}`;
}

export function buildTicketViewUrl(ticket: PublicTicketDTO): string {
  const token = ticket.verificationToken ?? '';
  return `/ticket/${encodeURIComponent(ticket.id)}?token=${encodeURIComponent(token)}`;
}

export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 320,
    margin: 1,
    color: {
      dark: '#242424',
      light: '#FAF8F4',
    },
    errorCorrectionLevel: 'M',
  });
}

function formatReadableDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = testLine;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function downloadTicketAsPng(ticket: PublicTicketDTO): Promise<void> {
  const canvas = document.createElement('canvas');
  const width = 1280;
  const height = 740;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Ivory canvas
  ctx.fillStyle = '#FAF8F4';
  ctx.fillRect(0, 0, width, height);

  // Outer & inner champagne gold editorial borders
  ctx.strokeStyle = '#B49A6C';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  ctx.strokeStyle = '#EAE5DC';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(36, 36, width - 72, height - 72);

  // Right stub divider
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = '#D5CCB9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(890, 56);
  ctx.lineTo(890, height - 56);
  ctx.stroke();
  ctx.restore();

  // Left main invitation area
  ctx.fillStyle = '#B49A6C';
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillText('SRI RAMA BHAKTHA JANA SAMAJ  ·  OFFICIAL ADMISSION PASS', 72, 86);

  ctx.fillStyle = '#242424';
  ctx.font = '600 54px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('MARGAZHI', 72, 148);

  ctx.fillStyle = '#737373';
  ctx.font = '400 20px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('28th Annual December Music Festival 2026', 72, 182);

  // Divider line
  ctx.strokeStyle = '#EAE5DC';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(72, 208);
  ctx.lineTo(846, 208);
  ctx.stroke();

  // Attendee & Date
  ctx.fillStyle = '#737373';
  ctx.font = '500 12px Inter, sans-serif';
  ctx.fillText('ATTENDEE', 72, 246);
  ctx.fillText('EVENT DATE', 480, 246);

  ctx.fillStyle = '#242424';
  ctx.font = '600 26px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(ticket.attendeeName, 72, 280);
  ctx.fillText(`${ticket.dayName}, ${formatReadableDate(ticket.eventDate)}`, 480, 280);

  // Concert Details
  ctx.fillStyle = '#737373';
  ctx.font = '500 12px Inter, sans-serif';
  ctx.fillText('CONCERT PROGRAM', 72, 338);

  let yPos = 368;
  for (const session of ticket.sessions.slice(0, 2)) {
    ctx.fillStyle = '#977E52';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText(`${session.startTime} – ${session.endTime}`, 72, yPos);
    yPos += 24;

    ctx.fillStyle = '#242424';
    ctx.font = '600 20px "Cormorant Garamond", Georgia, serif';
    const titleLines = wrapCanvasText(ctx, session.title, 760);
    for (const line of titleLines.slice(0, 2)) {
      ctx.fillText(line, 72, yPos);
      yPos += 25;
    }

    ctx.fillStyle = '#525252';
    ctx.font = '400 13px Inter, sans-serif';
    const artists = session.performers.join('  ·  ');
    const artistLines = wrapCanvasText(ctx, artists, 760);
    for (const line of artistLines.slice(0, 2)) {
      ctx.fillText(line, 72, yPos);
      yPos += 19;
    }
    yPos += 12;
  }

  // Venue at bottom left
  ctx.strokeStyle = '#EAE5DC';
  ctx.beginPath();
  ctx.moveTo(72, 598);
  ctx.lineTo(846, 598);
  ctx.stroke();

  ctx.fillStyle = '#737373';
  ctx.font = '500 12px Inter, sans-serif';
  ctx.fillText('VENUE', 72, 628);

  ctx.fillStyle = '#242424';
  ctx.font = '500 15px Inter, sans-serif';
  ctx.fillText(`${ticket.venue}, ${ticket.venueAddress}`, 72, 654);

  // Right stub: Seat & QR
  ctx.fillStyle = '#737373';
  ctx.font = '500 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ALLOCATED SEAT', 1070, 98);

  ctx.fillStyle = '#B49A6C';
  ctx.font = '600 84px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(ticket.seatLabel, 1070, 178);

  ctx.fillStyle = '#242424';
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.fillText(ticket.id, 1070, 214);

  const qrUrl = await generateQrDataUrl(buildTicketVerifyUrl(ticket));
  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => reject(new Error('QR image load failed'));
    qrImg.src = qrUrl;
  });

  // White frame behind QR
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(940, 250, 260, 260);
  ctx.strokeStyle = '#EAE5DC';
  ctx.strokeRect(940, 250, 260, 260);
  ctx.drawImage(qrImg, 954, 264, 232, 232);

  ctx.fillStyle = '#737373';
  ctx.font = '400 12px Inter, sans-serif';
  ctx.fillText('Scan at venue entrance for verification', 1070, 544);
  ctx.fillText(`Day ${ticket.dayNumber} of 9  ·  Admit One`, 1070, 568);

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${ticket.id}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadTicketsAsPdf(
  tickets: PublicTicketDTO[],
  filename = 'MARGAZHI-2026-Tickets'
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [210, 118],
  });

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (i > 0) {
      doc.addPage([210, 118], 'landscape');
    }

    // Background ivory
    doc.setFillColor(250, 248, 244);
    doc.rect(0, 0, 210, 118, 'F');

    // Gold border
    doc.setDrawColor(180, 154, 108);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, 200, 108);

    doc.setDrawColor(234, 229, 220);
    doc.setLineWidth(0.3);
    doc.rect(7.5, 7.5, 195, 103);

    // Stub separator
    doc.setDrawColor(213, 204, 185);
    doc.line(146, 10, 146, 108);

    // Header
    doc.setTextColor(180, 154, 108);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('SRI RAMA BHAKTHA JANA SAMAJ  |  OFFICIAL ADMISSION PASS', 14, 16);

    doc.setTextColor(36, 36, 36);
    doc.setFont('times', 'bold');
    doc.setFontSize(26);
    doc.text('MARGAZHI', 14, 26);

    doc.setTextColor(115, 115, 115);
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.text('28th Annual December Music Festival 2026', 14, 32);

    doc.setDrawColor(234, 229, 220);
    doc.line(14, 36, 140, 36);

    // Attendee + Date
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(115, 115, 115);
    doc.text('ATTENDEE', 14, 43);
    doc.text('EVENT DATE', 78, 43);

    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(36, 36, 36);
    doc.text(ticket.attendeeName.slice(0, 34), 14, 49);
    doc.text(`${ticket.dayName}, ${formatReadableDate(ticket.eventDate)}`, 78, 49);

    // Concert program
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(115, 115, 115);
    doc.text('CONCERT PROGRAM', 14, 58);

    let y = 63;
    for (const session of ticket.sessions.slice(0, 2)) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(151, 126, 82);
      doc.text(`${session.startTime} – ${session.endTime}`, 14, y);
      y += 4.5;

      doc.setFont('times', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(36, 36, 36);
      const wrappedTitle = doc.splitTextToSize(session.title, 124) as string[];
      doc.text(wrappedTitle.slice(0, 2), 14, y);
      y += wrappedTitle.slice(0, 2).length * 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(82, 82, 82);
      const wrappedPerf = doc.splitTextToSize(session.performers.join(' · '), 124) as string[];
      doc.text(wrappedPerf.slice(0, 2), 14, y);
      y += wrappedPerf.slice(0, 2).length * 3.8 + 2.5;
    }

    // Venue footer
    doc.setDrawColor(234, 229, 220);
    doc.line(14, 96, 140, 96);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(115, 115, 115);
    doc.text('VENUE', 14, 101);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(36, 36, 36);
    doc.text(`${ticket.venue}, ${ticket.venueAddress}`, 14, 106);

    // Right stub
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(115, 115, 115);
    doc.text('ALLOCATED SEAT', 176, 18, { align: 'center' });

    doc.setFont('times', 'bold');
    doc.setFontSize(34);
    doc.setTextColor(180, 154, 108);
    doc.text(ticket.seatLabel, 176, 31, { align: 'center' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(36, 36, 36);
    doc.text(ticket.id, 176, 38, { align: 'center' });

    const qrDataUrl = await generateQrDataUrl(buildTicketVerifyUrl(ticket));
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(234, 229, 220);
    doc.rect(155, 44, 42, 42, 'FD');
    doc.addImage(qrDataUrl, 'PNG', 157, 46, 38, 38);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(115, 115, 115);
    doc.text('Scan at entrance for verification', 176, 94, { align: 'center' });
    doc.text(`Day ${ticket.dayNumber} of 9 · Admit One`, 176, 99, { align: 'center' });
  }

  doc.save(`${filename}.pdf`);
}
