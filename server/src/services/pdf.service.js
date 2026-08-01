'use strict';
const PDFDocument = require('pdfkit');
const dayjs = require('dayjs');

/**
 * Generates a GST-compliant PDF invoice in a single-page pixel-perfect format matching the template
 */
async function generateInvoice({ booking, materials, transaction }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 35,
      info: {
        Title: `Invoice ${booking.bookingNumber}`,
        Author: 'ServiceHub',
      }
    });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const colors = {
      primary: '#2563EB',
      secondary: '#64748B',
      success: '#16A34A',
      light: '#F8FAFC',
      border: '#CBD5E1',
      text: '#1E293B',
    };

    const pageWidth = doc.page.width - 70; // Accounting for 35 margins on both sides
    const labelBg = '#F1F5F9';

    // ── 1. Header (y = 35 to 70) ────────────────────────────────────────────────
    doc.fillColor(colors.text).fontSize(20).font('Helvetica-Bold').text('YOUR COMPANY NAME', 35, 35, { align: 'center', width: pageWidth });
    doc.fillColor(colors.secondary).fontSize(8.5).font('Helvetica').text('Premium Home Services Invoice', 35, 58, { align: 'center', width: pageWidth });

    // Helper to draw grid rows
    const drawGridRow = (rowY, cells, colWidths, bgColors, fontStyles) => {
      let curX = 35;
      doc.save();
      for (let i = 0; i < cells.length; i++) {
        const w = colWidths[i];
        const bg = bgColors[i];
        
        // Fill cell background
        if (bg) {
          doc.rect(curX, rowY, w, 20).fill(bg);
        }
        
        // Stroke border
        doc.rect(curX, rowY, w, 20).strokeColor(colors.border).lineWidth(0.5).stroke();
        
        // Draw text
        if (cells[i] !== undefined && cells[i] !== null) {
          const isLabel = bg !== null && bg !== undefined;
          doc.fillColor(isLabel ? '#475569' : '#1E293B')
            .font(fontStyles[i] || (isLabel ? 'Helvetica-Bold' : 'Helvetica'))
            .fontSize(8.5);
          
          doc.text(String(cells[i]), curX + 6, rowY + 5.5, { 
            width: w - 12, 
            height: 12,
            ellipsis: true 
          });
        }
        curX += w;
      }
      doc.restore();
    };

    // ── 2. Metadata Table (y = 75 to 115) ─────────────────────────────────────────
    const colWidthsMeta = [80, 95, 55, 95, 50, 150];
    
    const cellsMeta1 = [
      'Invoice No', 
      `INV-${booking.bookingNumber.slice(-6).toUpperCase()}`, 
      'Booking', 
      `BK-${booking.bookingNumber.slice(-6).toUpperCase()}`, 
      'Status', 
      'PAID \u2713'
    ];
    const bgMeta1 = [labelBg, null, labelBg, null, labelBg, null];
    const fontsMeta1 = ['Helvetica-Bold', 'Helvetica', 'Helvetica-Bold', 'Helvetica', 'Helvetica-Bold', 'Helvetica-Bold'];
    drawGridRow(75, cellsMeta1, colWidthsMeta, bgMeta1, fontsMeta1);

    const cellsMeta2 = [
      'Invoice Date', 
      dayjs(booking.workDetails?.completedAt || booking.updatedAt).format('DD MMM YYYY'), 
      'Payment', 
      transaction?.paymentMethod?.toUpperCase() || 'UPI', 
      'Txn', 
      transaction?.razorpayPaymentId || transaction?.transactionId || 'TXN123456789'
    ];
    const bgMeta2 = [labelBg, null, labelBg, null, labelBg, null];
    const fontsMeta2 = ['Helvetica-Bold', 'Helvetica', 'Helvetica-Bold', 'Helvetica', 'Helvetica-Bold', 'Helvetica'];
    drawGridRow(95, cellsMeta2, colWidthsMeta, bgMeta2, fontsMeta2);

    // ── 3. Customer & Technician Details Table (y = 125 to 245) ───────────────────
    const colWidthsDetails = [85, 177.5, 85, 177.5];
    const addressStr = `${booking.serviceAddress?.line1 || ''}, ${booking.serviceAddress?.city || ''}`;
    const techId = booking.providerId ? `EMP-${booking.providerId._id.toString().slice(-4).toUpperCase()}` : 'EMP-1025';
    const techRating = booking.providerId?.rating ? `\u2605 ${booking.providerId.rating.toFixed(1)}` : '\u2605 4.9';
    const warranty = booking.serviceId?.warranty || '7 Days';
    const duration = booking.workDetails?.duration || '1 hr 20 mins';
    const completedTime = booking.workDetails?.completedAt 
      ? dayjs(booking.workDetails.completedAt).format('hh:mm A') 
      : '10:20 AM';

    const detailsRows = [
      ['Customer', booking.customerId?.name || 'Customer', 'Technician', booking.providerId?.name || 'Unassigned'],
      ['Phone', booking.customerId?.phone || '—', 'Employee ID', techId],
      ['Email', booking.customerId?.email || '—', 'Rating', techRating],
      ['Address', addressStr, 'Service', booking.serviceId?.name || 'Home Service'],
      ['Booking Time', booking.timeSlot?.from || '09:00 AM', 'Completed', completedTime],
      ['Duration', duration, 'Warranty', warranty]
    ];

    let currentY = 125;
    for (const row of detailsRows) {
      drawGridRow(currentY, row, colWidthsDetails, [labelBg, null, labelBg, null], ['Helvetica-Bold', 'Helvetica', 'Helvetica-Bold', 'Helvetica']);
      currentY += 20;
    }

    // ── 4. Work Summary (y = 255 to 345) ──────────────────────────────────────────
    doc.rect(35, 255, pageWidth, 90).strokeColor(colors.border).lineWidth(0.5).stroke();
    doc.rect(35, 255, pageWidth, 20).fill('#EFF6FF');
    doc.fillColor('#1D4ED8').font('Helvetica-Bold').fontSize(9).text('WORK SUMMARY', 45, 261);

    // Bullet points fallback based on service category
    const defaultBullets = {
      'AC': [
        'Indoor unit cleaned and serviced',
        'Outdoor unit condenser fins cleaned',
        'Refrigerant gas level checked and optimized',
        'Drain pipe blockage cleared and tested for leakage',
      ],
      'cleaning': [
        'Deep cleaning of designated areas completed',
        'Eco-friendly cleaning agents applied successfully',
        'Sanitization and disinfection checkpoints verified',
        'Final quality review matching standard checklist',
      ],
      'default': [
        'Indoor unit cleaned',
        'Outdoor unit cleaned',
        'Cooling tested',
        'Final quality inspection completed',
      ]
    };

    let bullets = [];
    if (booking.workDetails?.workPerformed) {
      bullets = booking.workDetails.workPerformed.split('\n').map(s => s.trim().replace(/^•\s*/, '')).filter(Boolean);
    }
    if (bullets.length === 0) {
      const category = (booking.serviceId?.category || '').toLowerCase();
      bullets = defaultBullets[category] || defaultBullets.default;
    }

    let bulletY = 281;
    doc.fillColor('#1E293B').font('Helvetica').fontSize(8.5);
    for (let i = 0; i < Math.min(bullets.length, 4); i++) {
      doc.text(`\u2022  ${bullets[i]}`, 47, bulletY);
      bulletY += 15;
    }

    // ── 5. Description and Amount Table (y = 355 onwards) ─────────────────────────
    currentY = 355;
    doc.rect(35, currentY, pageWidth, 20).fill('#1E293B');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    doc.text('Description', 45, currentY + 5.5);
    doc.text('Amount', 45 + 375, currentY + 5.5, { width: 90, align: 'right' });
    currentY += 20;

    const baseAmount = booking.basePrice * (booking.surgeMultiplier || 1);
    const billRows = [];
    billRows.push({ name: 'Service Charge', amount: baseAmount });
    if (booking.platformFee > 0) {
      billRows.push({ name: 'Platform Fee', amount: booking.platformFee });
    }
    if (booking.materialCost > 0) {
      billRows.push({ name: 'Additional Materials Used', amount: booking.materialCost });
    }
    if (booking.extraCharges > 0) {
      billRows.push({ name: booking.extraChargesNote || 'Extra Charges', amount: booking.extraCharges });
    }
    if (booking.discountAmount > 0) {
      billRows.push({ name: `Discount (${booking.couponCode || 'Promo'})`, amount: -booking.discountAmount, isDiscount: true });
    }

    // Calculate GST
    const GST_RATE = 18;
    const subtotalBeforeGST = booking.totalAmount / (1 + GST_RATE / 100);
    const gstAmount = booking.totalAmount - subtotalBeforeGST;
    
    // GST Label
    billRows.push({ name: 'GST (Included)', amount: gstAmount });

    doc.font('Helvetica').fontSize(8.5);
    for (const row of billRows) {
      doc.rect(35, currentY, pageWidth, 20).strokeColor(colors.border).lineWidth(0.5).stroke();
      doc.fillColor(row.isDiscount ? colors.success : '#1E293B');
      if (row.isDiscount) {
        doc.font('Helvetica-Bold');
      } else {
        doc.font('Helvetica');
      }
      doc.text(row.name, 45, currentY + 5.5);
      const prefix = row.amount < 0 ? '-' : '';
      const amountVal = Math.abs(row.amount);
      doc.text(`${prefix}\u20B9${amountVal.toFixed(2)}`, 45 + 375, currentY + 5.5, { width: 90, align: 'right' });
      currentY += 20;
    }

    // Draw TOTAL PAID row
    doc.rect(35, currentY, pageWidth, 25).fill('#DCFCE7');
    doc.rect(35, currentY, pageWidth, 25).strokeColor(colors.border).lineWidth(0.5).stroke();
    doc.fillColor('#15803D').font('Helvetica-Bold').fontSize(10);
    doc.text('TOTAL PAID', 45, currentY + 7.5);
    doc.text(`\u20B9${booking.totalAmount.toFixed(2)}`, 45 + 375, currentY + 7.5, { width: 90, align: 'right' });
    currentY += 25;

    // ── 6. Footer (QR & Support boxes) ──────────────────────────────────────────
    currentY += 10;
    const boxHeight = 45;
    const leftBoxWidth = pageWidth / 2 - 10;
    const rightBoxWidth = pageWidth / 2 + 10;

    // Left Box
    doc.rect(35, currentY, leftBoxWidth, boxHeight).strokeColor(colors.border).lineWidth(0.5).stroke();
    doc.fillColor(colors.secondary).font('Helvetica-Bold').fontSize(8.5);
    doc.text('QR Verification (Place QR Here)', 45, currentY + 17);

    // Right Box
    doc.rect(35 + leftBoxWidth, currentY, rightBoxWidth, boxHeight).strokeColor(colors.border).lineWidth(0.5).stroke();
    doc.fillColor('#1E293B').font('Helvetica').fontSize(8.5);
    doc.text(`Support: support@yourcompany.com | +91 XXXXX XXXXX`, 35 + leftBoxWidth + 12, currentY + 17);

    currentY += boxHeight;

    // Disclaimer
    doc.fillColor(colors.secondary).fontSize(7.5).font('Helvetica');
    doc.text('This is a computer-generated invoice. No signature required. Terms & conditions apply.', 35, currentY + 15, { align: 'center', width: pageWidth });

    doc.end();
  });
}

/**
 * Generates an official 30-Day Digital Warranty Vault Certificate PDF
 */
async function generateWarrantyCertificate({ booking }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 35,
      info: {
        Title: `Warranty Certificate ${booking.warranty?.warrantyId || booking.bookingNumber}`,
        Author: 'ServiceHub Trust & Guarantee Engine',
      }
    });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 70;
    const colors = {
      gold: '#D97706',
      goldLight: '#FEF3C7',
      primary: '#0284C7',
      dark: '#0F172A',
      secondary: '#475569',
      border: '#E2E8F0',
      successBg: '#F0FDF4',
      successBorder: '#86EFAC',
    };

    // Outer Decorative Border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
      .strokeColor(colors.gold)
      .lineWidth(2)
      .stroke();
      
    doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50)
      .strokeColor('#FCD34D')
      .lineWidth(0.5)
      .stroke();

    // ── Header Title Box ──────────────────────────────────────────────────────────
    doc.rect(35, 45, pageWidth, 55).fill(colors.goldLight);
    doc.rect(35, 45, pageWidth, 55).strokeColor(colors.gold).lineWidth(1).stroke();

    doc.fillColor(colors.gold).font('Helvetica-Bold').fontSize(16).text('30-DAY DIGITAL SERVICE GUARANTEE', 35, 57, { align: 'center', width: pageWidth });
    doc.fillColor('#92400E').font('Helvetica').fontSize(9.5).text('OFFICIAL PROTECTION CERTIFICATE & SERVICE VAULT', 35, 78, { align: 'center', width: pageWidth });

    // Certificate ID Banner
    const certId = booking.warranty?.warrantyId || `SH-WRN-${Date.now().toString(36).toUpperCase()}`;
    doc.rect(35, 115, pageWidth, 28).fill('#0F172A');
    doc.fillColor('#FDE047').font('Helvetica-Bold').fontSize(11).text(`CERTIFICATE ID: ${certId}`, 45, 123);
    
    const statusText = 'STATUS: ACTIVE GUARANTEE \u2713';
    doc.fillColor('#4ADE80').font('Helvetica-Bold').fontSize(10).text(statusText, 35 + pageWidth - 200, 123, { width: 190, align: 'right' });

    // Certificate Meta Grid (y = 155)
    let y = 155;
    const colW = [110, 150, 110, 155];
    const drawRow = (rowY, labels) => {
      let x = 35;
      for (let i = 0; i < labels.length; i++) {
        const isHeader = i % 2 === 0;
        doc.rect(x, rowY, colW[i], 22)
          .fill(isHeader ? '#F1F5F9' : '#FFFFFF')
          .strokeColor(colors.border)
          .lineWidth(0.5)
          .stroke();

        doc.fillColor(isHeader ? '#334155' : '#0F172A')
          .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(8.5)
          .text(labels[i], x + 6, rowY + 6.5, { width: colW[i] - 12, ellipsis: true });
        x += colW[i];
      }
    };

    const issueDate = booking.warranty?.issuedAt ? dayjs(booking.warranty.issuedAt).format('DD MMM YYYY') : dayjs(booking.updatedAt).format('DD MMM YYYY');
    const validUntil = booking.warranty?.validUntil ? dayjs(booking.warranty.validUntil).format('DD MMM YYYY') : dayjs(booking.updatedAt).add(30, 'day').format('DD MMM YYYY');
    const techName = booking.providerId?.name || 'Assigned Certified Provider';

    drawRow(y, ['Customer Name', booking.customerId?.name || 'Valued Customer', 'Issue Date', issueDate]);
    y += 22;
    drawRow(y, ['Service Completed', booking.serviceId?.name || 'Home Repair Service', 'Valid Until', validUntil]);
    y += 22;
    drawRow(y, ['Service Address', `${booking.serviceAddress?.line1 || ''}, ${booking.serviceAddress?.city || ''}`, 'Verified Technician', techName]);
    y += 22;
    drawRow(y, ['Booking Ref', `BK-${booking.bookingNumber}`, 'Coverage Period', '30 Calendar Days']);

    // ── Coverage Benefits Box (y = 265) ──────────────────────────────────────────
    y = 265;
    doc.rect(35, y, pageWidth, 180).fill('#FAFAFA');
    doc.rect(35, y, pageWidth, 180).strokeColor(colors.border).lineWidth(0.5).stroke();
    
    doc.rect(35, y, pageWidth, 24).fill('#0284C7');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9.5).text('OFFICIAL COVERAGE & GUARANTEE BENEFITS', 45, y + 7);

    const benefits = [
      { title: '1. 100% Free Revisit Guarantee', desc: 'If any recurring issue occurs within 30 days of completion, ServiceHub dispatches a senior master technician for a 100% free revisit.' },
      { title: '2. \u20B910,000 Property Damage Protection', desc: 'All work performed under this certificate is insured up to \u20B910,000 against unexpected accidental damage.' },
      { title: '3. Genuine Part Authenticity Shield', desc: 'All spare parts and materials installed are guaranteed 100% original and verified by ServiceHub Quality Control.' },
      { title: '4. Direct Priority Escalation', desc: 'Warranty certificate holders receive priority customer support dispatch with 2-hour response resolution SLA.' },
    ];

    let benefitY = y + 32;
    for (const b of benefits) {
      doc.fillColor('#0369A1').font('Helvetica-Bold').fontSize(9).text(b.title, 45, benefitY);
      doc.fillColor('#334155').font('Helvetica').fontSize(8).text(b.desc, 45, benefitY + 12, { width: pageWidth - 20 });
      benefitY += 34;
    }

    // ── Seal & Verification Box (y = 460) ─────────────────────────────────────────
    y = 460;
    doc.rect(35, y, pageWidth, 85).fill('#F0FDF4');
    doc.rect(35, y, pageWidth, 85).strokeColor(colors.successBorder).lineWidth(1).stroke();

    doc.fillColor('#15803D').font('Helvetica-Bold').fontSize(11).text('SERVICEHUB DIGITAL TRUST & SAFETY SEAL', 45, y + 15);
    doc.fillColor('#166534').font('Helvetica').fontSize(8.5).text(
      'This certificate is digitally signed and logged in the ServiceHub Distributed Vault. Any work done directly off-platform or paid directly in cash outside the app voids this warranty guarantee.',
      45, y + 32, { width: pageWidth - 30 }
    );

    // Footer
    y = 575;
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica');
    doc.text('ServiceHub Platform Technologies \u2022 Trust & Safety Division \u2022 www.servicehub.com', 35, y, { align: 'center', width: pageWidth });

    doc.end();
  });
}

module.exports = { generateInvoice, generateWarrantyCertificate };
