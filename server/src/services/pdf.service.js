'use strict';
const PDFDocument = require('pdfkit');
const dayjs = require('dayjs');
const { getInvoiceSettings, calculateInvoiceData } = require('./invoice.service');

/**
 * Generates a GST-compliant PDF invoice matching the exact OneWayFix template design and Admin Settings
 */
async function generateInvoice({ booking, materials, transaction, settingsOverride }) {
  const settings = settingsOverride || (await getInvoiceSettings()).toObject();
  const calc = calculateInvoiceData({ booking, materials, transaction, settings });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 35,
      info: {
        Title: `${settings.invoiceTitle || 'INVOICE'} ${booking?.bookingNumber || 'OWF-INV-100001'}`,
        Author: settings.companyName || 'ONEWAYFIX',
      }
    });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const design = settings.design || {};
    const colors = {
      headerBg: design.headerBg || '#ccfbf1',              // Mint Header
      footerBg: design.footerBg || '#ccfbf1',              // Mint Footer
      primary: design.primaryColor || '#0f766e',
      text: design.textColor || '#1e293b',
      secondary: '#475569',
      border: design.tableBorderColor || '#cbd5e1',
      guaranteeBg: design.guaranteeCardBg || '#ecfdf5',    // Green Guarantee Card
      guaranteeBorder: design.guaranteeBorderColor || '#059669',
    };

    const pageWidth = doc.page.width - 70; // 35 margins on both sides

    // ── 1. Top Header Banner (Mint Background) (y = 35 to 105) ────────────────────
    doc.rect(35, 35, pageWidth, 70).fill(colors.headerBg);
    
    // Left: INVOICE Title
    doc.fillColor(colors.text).fontSize(28).font('Helvetica-Bold').text(settings.invoiceTitle || 'INVOICE', 50, 48);
    doc.fillColor(colors.secondary).fontSize(10).font('Helvetica').text(settings.companyName || 'OneWayFix', 50, 80);

    // Right: Company Brand
    doc.fillColor(colors.text).fontSize(12).font('Helvetica-Bold').text(settings.companyName || 'ONEWAYFIX', 35, 52, { align: 'right', width: pageWidth - 15 });
    doc.fillColor(colors.secondary).fontSize(8.5).font('Helvetica').text(settings.brandTagline || 'Premium Home Services', 35, 68, { align: 'right', width: pageWidth - 15 });

    // ── 2. Metadata Bar (y = 115 to 145) ─────────────────────────────────────────
    const invNo = booking?.invoiceNumber || `${settings.numbering?.prefix || 'OWF-INV-'}${booking?.bookingNumber ? booking.bookingNumber.slice(-6).toUpperCase() : '100001'}`;
    const invDate = dayjs(booking?.workDetails?.completedAt || booking?.updatedAt || new Date()).format('DD MMM YYYY').toUpperCase();
    const payMethod = (transaction?.paymentMethod || booking?.paymentMethod || 'ONLINE / UPI').toUpperCase();
    const dueAmount = `\u20B9${calc.amountDue.toFixed(2)}`;

    const colW = pageWidth / 4;
    const metaCols = [
      { label: 'INVOICE NO.', val: invNo },
      { label: 'DATE', val: invDate },
      { label: 'PAYMENT METHOD', val: payMethod },
      { label: 'AMOUNT DUE', val: dueAmount },
    ];

    metaCols.forEach((col, idx) => {
      const x = 35 + idx * colW;
      doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold').text(col.label, x, 115);
      doc.fillColor('#0F172A').fontSize(9.5).font('Helvetica-Bold').text(col.val, x, 126);
    });

    // ── 3. Customer & Technician Side-by-Side Box (y = 150 to 220) ──────────────
    doc.rect(35, 150, pageWidth, 75).fill('#e6f4f1'); // Light mint container box
    
    // Left: BILL TO — CUSTOMER
    const custX = 45;
    doc.fillColor(colors.text).fontSize(8.5).font('Helvetica-Bold').text('BILL TO — CUSTOMER', custX, 158);
    doc.fillColor('#334155').fontSize(8).font('Helvetica');
    const custName = booking?.customerId?.name || 'Customer Name';
    const custPhone = booking?.customerId?.phone || '+91 XXXXX XXXXX';
    const custEmail = booking?.customerId?.email || 'customer@email.com';
    const custAddress = `${booking?.serviceAddress?.line1 || 'Full Address'}, ${booking?.serviceAddress?.city || ''}`;
    
    doc.text(`Customer Name: ${custName}`, custX, 170);
    doc.text(`Phone: ${custPhone}`, custX, 181);
    doc.text(`Email: ${custEmail}`, custX, 192);
    doc.text(`Service Address: ${custAddress.slice(0, 35)}`, custX, 203);

    // Right: BILL FROM — TECHNICIAN
    const techX = 35 + pageWidth / 2 + 10;
    doc.fillColor(colors.text).fontSize(8.5).font('Helvetica-Bold').text('BILL FROM — TECHNICIAN', techX, 158);
    doc.fillColor('#334155').fontSize(8).font('Helvetica');
    const techName = booking?.providerId?.name || 'Technician Name';
    const techEmp = booking?.providerId?._id ? `OWF-TECH-${booking.providerId._id.toString().slice(-6).toUpperCase()}` : 'OWF-TECH-000123';
    const techPhone = booking?.providerId?.phone || '+91 XXXXX XXXXX';
    const techCategory = booking?.serviceId?.name || booking?.serviceId?.category || 'AC Repair';
    const techRating = booking?.providerId?.rating ? `${booking.providerId.rating.toFixed(1)} \u2605` : '4.9 \u2605';

    doc.text(`Technician Name: ${techName}`, techX, 170);
    doc.text(`Employee ID: ${techEmp}`, techX, 181);
    doc.text(`Phone: ${techPhone}`, techX, 192);
    doc.text(`Service Category: ${techCategory}`, techX, 203);
    doc.text(`Rating: ${techRating}`, techX, 214);

    // ── 4. Items / Service Table (y = 240 onwards) ────────────────────────────────
    let curY = 240;
    doc.rect(35, curY, pageWidth, 20).fill('#0F172A'); // Dark Table Header
    doc.fillColor('white').font('Helvetica-Bold').fontSize(8.5);
    doc.text('ITEMS / SERVICE', 45, curY + 5.5);
    doc.text('QTY', 350, curY + 5.5, { width: 40, align: 'center' });
    doc.text('PRICE', 400, curY + 5.5, { width: 60, align: 'right' });
    doc.text('TOTAL AMOUNT', 470, curY + 5.5, { width: 80, align: 'right' });

    curY += 20;
    doc.font('Helvetica').fontSize(8);

    calc.serviceItems.forEach((item) => {
      doc.rect(35, curY, pageWidth, 20).strokeColor(colors.border).lineWidth(0.5).stroke();
      doc.fillColor('#1E293B').text(item.name, 45, curY + 5.5);
      doc.text(String(item.qty), 350, curY + 5.5, { width: 40, align: 'center' });
      doc.text(`\u20B9${item.price.toFixed(2)}`, 400, curY + 5.5, { width: 60, align: 'right' });
      doc.text(`\u20B9${item.total.toFixed(2)}`, 470, curY + 5.5, { width: 80, align: 'right' });
      curY += 20;
    });

    // ── 5. Financial Breakdown (Subtotal, GST, Discount, Total) ────────────────────
    curY += 10;
    const drawSummaryLine = (label, val, isBold = false) => {
      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor('#1E293B');
      doc.text(label, 35, curY, { width: 430, align: 'left' });
      doc.text(`\u20B9${val.toFixed(2)}`, 470, curY, { width: 80, align: 'right' });
      curY += 16;
    };

    drawSummaryLine('SUBTOTAL', calc.subtotal, true);
    if (settings.showGst !== false) {
      drawSummaryLine(`GST (${settings.gstMode === 'included' ? 'Included' : '18%'})`, calc.gstAmount);
    }
    if (calc.discount > 0) {
      drawSummaryLine('DISCOUNT', -calc.discount);
    }

    // Divider Line before TOTAL
    doc.moveTo(35, curY).lineTo(35 + pageWidth, curY).strokeColor('#0F172A').lineWidth(1).stroke();
    curY += 6;

    // TOTAL Highlight Row
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A');
    doc.text('TOTAL', 350, curY);
    doc.text(`\u20B9${calc.totalAmount.toFixed(2)}`, 470, curY, { width: 80, align: 'right' });
    curY += 24;

    // ── 6. Green Guarantee Card (y = curY) ────────────────────────────────────────
    const guaranteeTitle = settings.guarantee?.title || '1-MONTH SERVICE GUARANTEE';
    const guaranteeDesc = settings.guarantee?.description || 'Your completed service is covered by a 1-month service guarantee, subject to OneWayFix service terms and applicable conditions.';

    if (settings.guarantee?.enabled !== false) {
      doc.rect(35, curY, pageWidth, 45).fill(colors.guaranteeBg);
      doc.rect(35, curY, pageWidth, 45).strokeColor(colors.guaranteeBorder).lineWidth(1).stroke();

      doc.fillColor(colors.guaranteeBorder).fontSize(9.5).font('Helvetica-Bold').text(`\u2713 ${guaranteeTitle}`, 45, curY + 10);
      doc.fillColor('#047857').fontSize(7.5).font('Helvetica').text(guaranteeDesc, 45, curY + 26, { width: pageWidth - 20 });
      curY += 55;
    }

    // ── 7. Booking & Support Info Side-by-Side Boxes ──────────────────────────────
    const boxW = (pageWidth - 10) / 2;
    
    // Left Box: Booking & Payment Status
    doc.rect(35, curY, boxW, 55).fill('#e6f4f1');
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold').text('BOOKING', 45, curY + 8);
    doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold').text(`BK-${booking?.bookingNumber ? booking.bookingNumber.slice(-8).toUpperCase() : 'XXXX-XXXX'}`, 45, curY + 18);
    
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold').text('PAYMENT STATUS', 45, curY + 32);
    doc.fillColor('#059669').fontSize(8.5).font('Helvetica-Bold').text('PAID \u2713', 45, curY + 42);

    // Right Box: Support & QR Verification
    const rightX = 35 + boxW + 10;
    doc.rect(rightX, curY, boxW, 55).fill('#e6f4f1');
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold').text('SUPPORT', rightX + 10, curY + 8);
    doc.fillColor('#0F172A').fontSize(8).font('Helvetica').text(settings.supportEmail || 'support@onewayfix.com', rightX + 10, curY + 18);
    doc.fillColor('#0F172A').fontSize(8).font('Helvetica').text(settings.supportPhone || '+91 XXXXX XXXXX', rightX + 10, curY + 28);

    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold').text('QR VERIFICATION', rightX + 10, curY + 40);
    doc.fillColor('#0F172A').fontSize(8).font('Helvetica-Bold').text('[ QR ]', rightX + 90, curY + 40);

    curY += 65;

    // ── 8. Bottom Thank You Section (Mint Background) ─────────────────────────────
    doc.rect(35, curY, pageWidth, 55).fill(colors.footerBg);
    doc.fillColor(colors.text).fontSize(10).font('Helvetica-Bold').text(settings.footer?.thankYouTitle || 'THANK YOU!', 45, curY + 10);
    doc.fillColor(colors.secondary).fontSize(7.5).font('Helvetica').text(
      settings.footer?.thankYouMessage || 'Thank you for choosing OneWayFix for your home service needs. We appreciate your trust and look forward to serving you again.',
      45, curY + 24, { width: pageWidth - 20 }
    );
    doc.fillColor('#64748B').fontSize(7.0).font('Helvetica').text(
      settings.footer?.termsText || 'This is a computer-generated invoice. No signature required. Terms & conditions apply.',
      45, curY + 40, { width: pageWidth - 20 }
    );

    doc.end();
  });
}

/**
 * Generates an official Warranty Certificate PDF
 */
async function generateWarrantyCertificate({ booking }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 35 });
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 70;
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).strokeColor('#D97706').lineWidth(2).stroke();
    doc.rect(35, 45, pageWidth, 55).fill('#FEF3C7');
    doc.fillColor('#D97706').font('Helvetica-Bold').fontSize(16).text('30-DAY DIGITAL SERVICE GUARANTEE', 35, 57, { align: 'center', width: pageWidth });
    doc.fillColor('#92400E').font('Helvetica').fontSize(9.5).text('OFFICIAL PROTECTION CERTIFICATE & SERVICE VAULT', 35, 78, { align: 'center', width: pageWidth });
    doc.end();
  });
}

module.exports = { generateInvoice, generateWarrantyCertificate };
