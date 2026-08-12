'use strict';

const { InvoiceSettings, Invoice, Booking, User, Provider, Transaction, MaterialsUsed } = require('../models');

const DEFAULT_SECTIONS = [
  { id: 'header', title: 'Invoice Header', enabled: true, order: 1 },
  { id: 'metadata', title: 'Invoice Metadata', enabled: true, order: 2 },
  { id: 'parties', title: 'Customer & Technician Details', enabled: true, order: 3 },
  { id: 'items', title: 'Items / Service Table', enabled: true, order: 4 },
  { id: 'breakdown', title: 'Subtotal & Tax Breakdown', enabled: true, order: 5 },
  { id: 'guarantee', title: 'Service Guarantee Card', enabled: true, order: 6 },
  { id: 'support', title: 'Booking & Support Info', enabled: true, order: 7 },
  { id: 'thankyou', title: 'Thank You Footer', enabled: true, order: 8 },
];

const DEFAULT_CHARGES = [
  { id: 'service_charge', name: 'Service Charge', enabled: true, type: 'actual', value: 0, order: 1 },
  { id: 'platform_fee', name: 'Platform / Service Fee', enabled: true, type: 'fixed', value: 100, order: 2 },
  { id: 'parts_materials', name: 'Parts / Materials', enabled: true, type: 'actual', value: 0, order: 3 },
  { id: 'additional_charges', name: 'Additional Charges', enabled: true, type: 'actual', value: 0, order: 4 },
  { id: 'discount', name: 'Discount', enabled: true, type: 'actual', value: 0, order: 5 },
];

/**
 * Gets global invoice settings, or creates default settings if none exist.
 */
async function getInvoiceSettings() {
  let settings = await InvoiceSettings.findOne({ key: 'global' });
  if (!settings) {
    settings = await InvoiceSettings.create({
      key: 'global',
      sections: DEFAULT_SECTIONS,
      charges: DEFAULT_CHARGES,
    });
  }
  return settings;
}

/**
 * Saves or updates invoice settings on the server.
 */
async function updateInvoiceSettings(updates) {
  let settings = await InvoiceSettings.findOne({ key: 'global' });
  if (!settings) {
    settings = new InvoiceSettings({ key: 'global', sections: DEFAULT_SECTIONS, charges: DEFAULT_CHARGES });
  }

  // Deep update settings fields
  Object.assign(settings, updates);
  settings.settingsVersion = (settings.settingsVersion || 1) + 1;
  await settings.save();
  return settings;
}

/**
 * Calculates complete financial breakdown from booking and settings snapshot.
 */
function calculateInvoiceData({ booking, materials, transaction, settings }) {
  const baseService = (booking?.basePrice || 501) * (booking?.surgeMultiplier || 1.0);
  const platformFee = booking?.platformFee ?? 100;
  const partsAmount = materials?.subtotal || booking?.materialCost || 0;
  const additionalCharges = booking?.extraCharges || 0;
  const discount = booking?.discountAmount || 0;

  // Raw Subtotal before GST calculation
  const subtotal = baseService + platformFee + partsAmount + additionalCharges;

  let gstRate = settings?.gstEnabled !== false ? (settings?.gstPercentage || 18) : 0;
  let gstMode = settings?.gstMode || 'included';

  let gstAmount = 0;
  let taxableAmount = subtotal - discount;
  let totalAmount = taxableAmount;

  if (settings?.gstEnabled !== false && gstRate > 0) {
    if (gstMode === 'included') {
      // Inclusive GST: Taxable = Total / (1 + rate/100)
      totalAmount = Math.max(0, subtotal - discount);
      taxableAmount = totalAmount / (1 + gstRate / 100);
      gstAmount = totalAmount - taxableAmount;
    } else if (gstMode === 'added_separately') {
      // Exclusive GST: Taxable = Subtotal - Discount; GST = Taxable * (rate/100)
      taxableAmount = Math.max(0, subtotal - discount);
      gstAmount = taxableAmount * (gstRate / 100);
      totalAmount = taxableAmount + gstAmount;
    } else {
      // No GST
      totalAmount = Math.max(0, subtotal - discount);
      taxableAmount = totalAmount;
      gstAmount = 0;
    }
  }

  // CGST / SGST split
  const cgstAmount = settings?.showCgst ? gstAmount / 2 : 0;
  const sgstAmount = settings?.showSgst ? gstAmount / 2 : 0;
  const igstAmount = settings?.showIgst ? gstAmount : 0;

  const isPaid = booking?.status === 'paid' || transaction?.status === 'success';
  const amountPaid = isPaid ? totalAmount : 0;
  const amountDue = isPaid ? 0 : totalAmount;

  // Build service items array
  const serviceItems = [
    { name: booking?.serviceId?.name ? `${booking.serviceId.name}` : 'AC Repair - Gas Charging', qty: 1, price: baseService, total: baseService },
    { name: 'Platform / Service Fee', qty: 1, price: platformFee, total: platformFee },
    { name: 'Parts / Materials', qty: 1, price: partsAmount, total: partsAmount },
    { name: 'Additional Charges', qty: 1, price: additionalCharges, total: additionalCharges },
  ];

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    gstEnabled: settings?.gstEnabled !== false,
    gstMode,
    gstRate,
    gstAmount: Math.round(gstAmount * 100) / 100,
    cgstAmount: Math.round(cgstAmount * 100) / 100,
    sgstAmount: Math.round(sgstAmount * 100) / 100,
    igstAmount: Math.round(igstAmount * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    serviceCharge: Math.round(baseService * 100) / 100,
    partsAmount: Math.round(partsAmount * 100) / 100,
    additionalCharges: Math.round(additionalCharges * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    amountPaid: Math.round(amountPaid * 100) / 100,
    amountDue: Math.round(amountDue * 100) / 100,
    serviceItems,
  };
}

/**
 * Generates next unique invoice number on the backend.
 */
async function generateNextInvoiceNumber(settings) {
  const numbering = settings.numbering || {};
  const prefix = numbering.prefix || 'OWF-INV-';
  const startNum = numbering.nextNumber || numbering.startingNumber || 100001;
  const len = numbering.numberLength || 6;

  let formattedNum = String(startNum).padStart(len, '0');
  let datePart = '';
  
  if (numbering.includeYear) {
    const year = new Date().getFullYear();
    datePart += `${year}-`;
  }
  if (numbering.includeMonth) {
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    datePart += `${month}-`;
  }

  const invoiceNumber = `${prefix}${datePart}${formattedNum}`;

  // Update next number atomically in settings
  settings.numbering.nextNumber = startNum + 1;
  await settings.save();

  return invoiceNumber;
}

/**
 * Fetches existing invoice snapshot for booking or creates a new historical snapshot.
 */
async function getOrCreateInvoiceForBooking(bookingId) {
  let invoice = await Invoice.findOne({ bookingId });
  if (invoice) return invoice;

  const booking = await Booking.findById(bookingId)
    .populate('serviceId', 'name category')
    .populate('customerId', 'name phone email addresses')
    .populate('providerId', 'name phone rating kyc services')
    .lean();

  if (!booking) throw new Error('Booking not found');

  const materials = await MaterialsUsed.findOne({ bookingId }).lean();
  const transaction = await Transaction.findOne({ bookingId, status: 'success' }).lean();
  const settings = await getInvoiceSettings();

  const calc = calculateInvoiceData({ booking, materials, transaction, settings });
  const invoiceNumber = await generateNextInvoiceNumber(settings);

  // Build snapshots
  const companySnapshot = {
    companyName: settings.companyName,
    brandTagline: settings.brandTagline,
    website: settings.website,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    companyAddress: settings.companyAddress,
    gstin: settings.gstin,
    cin: settings.cin,
    logoUrl: settings.logoUrl,
    invoiceTitle: settings.invoiceTitle,
  };

  const customerSnapshot = {
    name: booking.customerId?.name || 'Customer',
    phone: booking.customerId?.phone || '—',
    email: booking.customerId?.email || '—',
    address: `${booking.serviceAddress?.line1 || ''}, ${booking.serviceAddress?.city || ''}`,
  };

  const techId = booking.providerId ? `OWF-TECH-${booking.providerId._id.toString().slice(-6).toUpperCase()}` : 'EMP-000123';
  const technicianSnapshot = {
    name: booking.providerId?.name || 'Assigned Technician',
    employeeId: techId,
    phone: booking.providerId?.phone || '—',
    serviceCategory: booking.serviceId?.name || booking.serviceId?.category || 'Home Services',
    rating: booking.providerId?.rating ? `★ ${booking.providerId.rating.toFixed(1)}` : '★ 4.9',
  };

  invoice = await Invoice.create({
    invoiceNumber,
    bookingId: booking._id,
    customerId: booking.customerId?._id || booking.customerId,
    technicianId: booking.providerId?._id || booking.providerId,
    companySnapshot,
    customerSnapshot,
    technicianSnapshot,
    serviceItems: calc.serviceItems,
    subtotal: calc.subtotal,
    discount: calc.discount,
    taxableAmount: calc.taxableAmount,
    gstEnabled: calc.gstEnabled,
    gstMode: calc.gstMode,
    gstRate: calc.gstRate,
    gstAmount: calc.gstAmount,
    cgstAmount: calc.cgstAmount,
    sgstAmount: calc.sgstAmount,
    igstAmount: calc.igstAmount,
    platformFee: calc.platformFee,
    serviceCharge: calc.serviceCharge,
    partsAmount: calc.partsAmount,
    additionalCharges: calc.additionalCharges,
    totalAmount: calc.totalAmount,
    amountPaid: calc.amountPaid,
    amountDue: calc.amountDue,
    paymentMethod: transaction?.paymentMethod || booking.paymentMethod || 'ONLINE / UPI',
    transactionId: transaction?.razorpayPaymentId || transaction?.transactionId || 'TXN_ONLINE_PAID',
    paymentStatus: 'PAID ✓',
    guaranteeEnabled: settings.guarantee?.enabled !== false,
    guaranteeTitle: `${settings.guarantee?.duration || 1}-${(settings.guarantee?.unit || 'Months').toUpperCase().slice(0, -1)} SERVICE GUARANTEE`,
    guaranteeText: settings.guarantee?.description,
    settingsVersion: settings.settingsVersion || 1,
    settingsSnapshot: settings.toObject(),
  });

  return invoice;
}

module.exports = {
  getInvoiceSettings,
  updateInvoiceSettings,
  calculateInvoiceData,
  generateNextInvoiceNumber,
  getOrCreateInvoiceForBooking,
};
