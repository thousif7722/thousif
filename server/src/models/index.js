'use strict';
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// ══════════════════════════════════════════════════════════════════════════════
// USER MODEL
// ══════════════════════════════════════════════════════════════════════════════
const AddressSchema = new mongoose.Schema({
  label: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
  line1: { type: String, required: true },
  line2: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const UserSchema = new mongoose.Schema({
  phone: { type: String, unique: true, sparse: true, index: true },
  firebaseUid: { type: String, unique: true, sparse: true, index: true },
  name: { type: String, trim: true },
  email: { type: String, lowercase: true, sparse: true, index: true },
  avatar: String,
  role: {
    type: String,
    enum: ['customer', 'provider', 'admin', 'staff', 'manager', 'team_leader', 'executive', 'technician', 'intern'],
    default: 'customer'
  },
  permissions: [{ type: String }], // Used for 'staff' role
  employeeId: { type: String, sparse: true, index: true },
  department: String,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  designation: String,
  branch: String,
  joiningDate: { type: Date, default: Date.now },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  teamLeaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  customRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  hierarchyLevel: { type: Number, default: 0 },
  documents: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  addresses: [AddressSchema],
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Provider' }],
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  walletBalance: { type: Number, default: 0, min: 0 },
  isBlocked: { type: Boolean, default: false },
  blockReason: String,
  status: { type: String, enum: ['active', 'resigned', 'blocked'], default: 'active' },
  isOnline: { type: Boolean, default: false },
  lastActiveAt: { type: Date, default: Date.now },
  fcmToken: String,           // Push notifications
  lastSeen: Date,
  totalBookings: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  deviceInfo: {
    platform: String,
    version: String,
    deviceId: String,
  },
  availability: { type: String, enum: ['available', 'busy', 'offline'], default: 'offline' },
  
  // ServiceHub PLUS Subscription Membership (Pillar 5)
  subscription: {
    isPlusMember: { type: Boolean, default: false },
    plan: { type: String, enum: ['none', 'free', 'basic', 'pro', 'premium', 'plus_6m', 'plus_12m'], default: 'free' },
    expiresAt: Date,
    purchasedAt: Date,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

UserSchema.index({ 'addresses.location': '2dsphere' });
UserSchema.index({ createdAt: -1 });                  // SCALE: Admin user list sort
UserSchema.index({ isBlocked: 1, role: 1 });          // SCALE: Blocked user filter
UserSchema.index({ phone: 1 }, { unique: true, sparse: true }); // SCALE: Auth lookup (sparse unique prevents duplicate null errors)

// ══════════════════════════════════════════════════════════════════════════════
// PROVIDER MODEL
// ══════════════════════════════════════════════════════════════════════════════
const KYCSchema = new mongoose.Schema({
  aadhaarNumber: String,
  aadhaarDoc: String,       // S3 URL
  panNumber: String,
  panDoc: String,
  selfie: String,
  status: {
    type: String,
    enum: ['not_submitted', 'pending', 'submitted', 'approved', 'rejected', 'verified'],
    default: 'not_submitted',
  },
  rejectionReason: String,
  verifiedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Staff handling KYC
});

const EarningsSchema = new mongoose.Schema({
  totalEarned: { type: Number, default: 0 },
  pendingPayout: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 },          // Withdrawable provider balance
  securityDeposit: { type: Number, default: 0, min: 0 }, // Locked balance for cash commission recovery
  pendingCommission: { type: Number, default: 0 },      // Cash commission owed to platform
  commissionDueSince: { type: Date, default: null },    // When commission debt started
  isOnHold: { type: Boolean, default: false },          // Job hold due to unpaid commission
  bankAccount: {
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    accountHolder: String,
    verified: { type: Boolean, default: false },
  },
}, { _id: false });

const ProviderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  phone: { type: String, unique: true, sparse: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true },
  avatar: String,

  // Service capabilities
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  specializations: [String],
  experience: { type: Number, default: 0 }, // Years

  // Trust Badges & SLA Metrics (Pillars 2 & 3)
  googleRating: { type: Number, default: 4.9 },
  googleReviewCount: { type: Number, default: 42 },
  isGoogleVerified: { type: Boolean, default: true },
  badges: { type: [String], default: ['Google Verified', 'Background Checked', 'Aadhaar Verified', 'ServiceHub Certified'] },
  acceptanceRate: { type: Number, default: 98 }, // %
  totalJobsAccepted: { type: Number, default: 0 },
  totalJobsCancelled: { type: Number, default: 0 },

  // Location
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] }, // [lng, lat]
    updatedAt: Date,
  },
  serviceRadius: { type: Number, default: 10 }, // km
  city: String,
  state: String,

  // Status
  isOnline: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending',
    index: true,
  },
  isBlocked: { type: Boolean, default: false },
  blockReason: String,

  // Job Access Freeze (7-day unresolved complaint rule)
  jobAccessStatus: { type: String, enum: ['active', 'frozen'], default: 'active', index: true },
  freezeReason: String,
  freezeStartedAt: Date,
  freezeComplaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },

  // KYC
  kyc: KYCSchema,

  // Performance
  rating: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  cancelledJobs: { type: Number, default: 0 },
  warningCount: { type: Number, default: 0 },
  warnings: [{
    reason: String,
    issuedAt: Date,
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],

  // Ranking
  tier: { type: String, enum: ['bronze', 'silver', 'gold', 'verified_pro', 'platinum'], default: 'bronze' },

  // Earnings
  earnings: { type: EarningsSchema, default: {} },

  // Availability
  availability: {
    monday: { from: String, to: String, available: { type: Boolean, default: true } },
    tuesday: { from: String, to: String, available: { type: Boolean, default: true } },
    wednesday: { from: String, to: String, available: { type: Boolean, default: true } },
    thursday: { from: String, to: String, available: { type: Boolean, default: true } },
    friday: { from: String, to: String, available: { type: Boolean, default: true } },
    saturday: { from: String, to: String, available: { type: Boolean, default: true } },
    sunday: { from: String, to: String, available: { type: Boolean, default: false } },
  },

  // Fraud
  riskScore: { type: Number, default: 0, min: 0, max: 100 },
  fcmToken: String,
  deviceInfo: { platform: String, version: String },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

ProviderSchema.index({ currentLocation: '2dsphere' });
ProviderSchema.index({ services: 1, isOnline: 1, approvalStatus: 1 });
ProviderSchema.index({ rating: -1, completedJobs: -1 });
// SCALE: Additional indexes for matching engine and admin queries
ProviderSchema.index({ isBlocked: 1, approvalStatus: 1, isOnline: 1 });   // Matching filter
ProviderSchema.index({ 'earnings.isOnHold': 1, approvalStatus: 1 });      // Commission hold filter
ProviderSchema.index({ riskScore: -1 });                                   // Fraud dashboard sort
ProviderSchema.index({ city: 1, approvalStatus: 1, isOnline: 1 });        // City-based admin view

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE CATALOG MODEL
// ══════════════════════════════════════════════════════════════════════════════
const ServiceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  category: { type: String, required: true, index: true },
  subcategory: String,
  serviceType: { type: String, enum: ['visit_inspection', 'fixed_repair'], default: 'fixed_repair' },
  categoryOptions: [{
    optionName: { type: String, required: true },
    fixedPrice: { type: Number, required: true },
    description: String,
  }],
  spareParts: [{
    name: { type: String, required: true },
    price: { type: Number, required: true },
    icon: { type: String, default: '🔧' },
    isAvailable: { type: Boolean, default: true },
  }],
  description: { type: String, required: true },
  icon: String,
  image: String,
  basePrice: { type: Number, required: true, min: 0 },
  priceType: { type: String, enum: ['fixed', 'hourly', 'quote'], default: 'fixed' },
  duration: { type: Number, default: 60 }, // minutes
  isActive: { type: Boolean, default: true, index: true },
  tags: [String],
  faqs: [{ question: String, answer: String }],
  includes: [String],
  excludes: [String],
  warrantyDays: { type: Number, default: 30 },
  plusDiscountPct: { type: Number, default: 10 },
  minProviderTier: { type: String, enum: ['any', 'verified_pro', 'platinum'], default: 'any' },
  sortOrder: { type: Number, default: 0 },
  popularityScore: { type: Number, default: 0 },
}, { timestamps: true });

// ══════════════════════════════════════════════════════════════════════════════
// BOOKING MODEL
// ══════════════════════════════════════════════════════════════════════════════
const TimelineEventSchema = new mongoose.Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  note: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId },
}, { _id: false });

const BookingSchema = new mongoose.Schema({
  bookingNumber: { type: String, unique: true, index: true },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    index: true,
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
  },

  // Scheduling
  scheduledDate: { type: Date, required: true },
  timeSlot: {
    from: { type: String, required: true }, // "10:00"
    to: { type: String, required: true },   // "11:00"
  },

  // Address
  serviceAddress: {
    line1: { type: String, required: true },
    line2: String,
    city: String,
    state: String,
    pincode: String,
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
  },

  // Status lifecycle
  status: {
    type: String,
    enum: [
      'pending',       // Waiting for provider assignment
      'assigned',      // System assigned a provider
      'accepted',      // Provider accepted
      'in_progress',   // Work started
      'completed',     // Work done, awaiting payment
      'paid',          // Payment received
      'cancelled',     // Cancelled by customer/provider/system
      'disputed',      // Under complaint
    ],
    default: 'pending',
    index: true,
  },
  timeline: [TimelineEventSchema],

  // Pricing
  basePrice: { type: Number, required: true },
  materialCost: { type: Number, default: 0 },
  extraCharges: { type: Number, default: 0 },
  extraChargesNote: String,
  discountAmount: { type: Number, default: 0 },
  couponCode: String,
  surgeMultiplier: { type: Number, default: 1.0 },
  totalAmount: { type: Number },
  platformFee: { type: Number, default: 0 },
  providerEarnings: { type: Number, default: 0 },
  commissionRate: { type: Number, default: 20 }, // %
  paymentMethod: { type: String, enum: ['cash', 'online', 'wallet', 'razorpay'] },

  // Cancellation
  cancellation: {
    cancelledBy: { type: String, enum: ['customer', 'provider', 'system', 'admin'] },
    reason: String,
    cancelledAt: Date,
    refundAmount: { type: Number, default: 0 },
    cancellationCharge: { type: Number, default: 0 },
  },

  // Assignment tracking (for retry logic)
  assignmentAttempts: { type: Number, default: 0 },
  rejectedProviders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Provider' }],
  assignmentTimeout: Date,

  // Work details
  workDetails: {
    issueDescription: String,
    workPerformed: String,
    startedAt: Date,
    completedAt: Date,
    beforePhotos: [String],
    afterPhotos: [String],
  },

  // OTP for verification
  startOtp: String,
  endOtp: String,

  // Rating
  isRated: { type: Boolean, default: false },

  // On-Site Addons / Quotation for Visit & Inspection Bookings
  quotation: {
    addons: [{
      serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
      name: String,
      price: Number,
      category: String,
    }],
    totalAddonPrice: { type: Number, default: 0 },
    note: String,
    status: { type: String, enum: ['none', 'pending', 'approved', 'declined'], default: 'none' },
    requestedAt: Date,
    respondedAt: Date,
  },

  // 30-Day Service Guarantee Warranty Vault
  warranty: {
    warrantyId: String,
    issuedAt: Date,
    validUntil: Date,
    status: { type: String, enum: ['active', 'expired', 'claimed'], default: 'active' },
    terms: String,
  },

  // Notes
  customerNotes: String,
  internalNotes: String,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

BookingSchema.index({ 'serviceAddress.location': '2dsphere' });
BookingSchema.index({ customerId: 1, status: 1, createdAt: -1 });
BookingSchema.index({ providerId: 1, status: 1, scheduledDate: 1 });
BookingSchema.index({ scheduledDate: 1, status: 1 });
// SCALE: Additional indexes for admin queries and city-based matching
BookingSchema.index({ status: 1, createdAt: -1 });                        // Admin bookings list
BookingSchema.index({ 'serviceAddress.city': 1, status: 1, createdAt: -1 }); // City-based dashboard
BookingSchema.index({ serviceId: 1, status: 1, createdAt: -1 });           // Top services analytics

// Auto-generate booking number
BookingSchema.pre('save', async function (next) {
  if (!this.bookingNumber) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    this.bookingNumber = `SH${ts}${rand}`;
  }
  // Calculate total including approved quotation addons
  const addonTotal = this.quotation?.status === 'approved' ? (this.quotation?.totalAddonPrice || 0) : 0;
  this.totalAmount = (
    this.basePrice * (this.surgeMultiplier || 1) +
    (this.materialCost || 0) +
    (this.extraCharges || 0) +
    addonTotal -
    (this.discountAmount || 0)
  );
  // Calculate commission
  this.platformFee = Math.round(this.totalAmount * (this.commissionRate / 100));
  this.providerEarnings = this.totalAmount - this.platformFee;
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// MATERIALS USED MODEL
// ══════════════════════════════════════════════════════════════════════════════
const MaterialItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'pcs' },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number },
  brand: String,
  isProviderOwned: { type: Boolean, default: true }, // false = customer-supplied
}, { _id: true });

MaterialItemSchema.pre('save', function (next) {
  this.totalPrice = this.quantity * this.unitPrice;
  next();
});

const MaterialsUsedSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true,
  },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [MaterialItemSchema],
  subtotal: { type: Number, default: 0 },
  customerApproved: { type: Boolean, default: false },
  approvedAt: Date,
  disputeRaised: { type: Boolean, default: false },
  disputeNote: String,
  notes: String,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

MaterialsUsedSchema.pre('save', function (next) {
  this.subtotal = this.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTION MODEL
// ══════════════════════════════════════════════════════════════════════════════
const TransactionSchema = new mongoose.Schema({
  transactionId: { type: String, unique: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },

  type: {
    type: String,
    enum: [
      'payment',         // Customer pays
      'refund',          // Refund to customer
      'commission',      // Platform commission deducted
      'wallet_credit',   // Provider wallet top-up
      'wallet_debit',    // Provider withdrawal
      'settlement',      // Provider payout
      'cancellation_fee',
    ],
    required: true,
  },

  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['pending', 'processing', 'success', 'failed', 'refunded'],
    default: 'pending',
    index: true,
  },

  // Razorpay fields
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  razorpayRefundId: String,

  paymentMethod: { type: String, enum: ['online', 'cash', 'wallet'] },
  gateway: { type: String, default: 'razorpay' },

  // Idempotency
  idempotencyKey: { type: String, unique: true, sparse: true },

  // Tax
  gstRate: { type: Number, default: 18 },
  gstAmount: { type: Number, default: 0 },

  // Split
  platformAmount: Number,
  providerAmount: Number,

  failureReason: String,
  metadata: mongoose.Schema.Types.Mixed,
  invoiceUrl: String,
}, {
  timestamps: true,
});

TransactionSchema.pre('save', function (next) {
  if (!this.transactionId) {
    this.transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  this.gstAmount = Math.round(this.amount * (this.gstRate / 100));
  next();
});

// SCALE: Indexes for financial queries
TransactionSchema.index({ providerId: 1, type: 1, status: 1, createdAt: -1 }); // Provider settlement view
TransactionSchema.index({ type: 1, status: 1, createdAt: -1 });                 // Admin financials
TransactionSchema.index({ bookingId: 1, type: 1 });                              // Booking payment lookup

// ══════════════════════════════════════════════════════════════════════════════
// REVIEW MODEL
// ══════════════════════════════════════════════════════════════════════════════
const ReviewSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true,
  },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },

  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 500 },
  photos: [String],

  aspects: {
    punctuality: { type: Number, min: 1, max: 5 },
    quality: { type: Number, min: 1, max: 5 },
    behaviour: { type: Number, min: 1, max: 5 },
    cleanliness: { type: Number, min: 1, max: 5 },
  },

  providerResponse: {
    text: String,
    respondedAt: Date,
  },

  isVisible: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: true },
  helpfulCount: { type: Number, default: 0 },
  flagged: { type: Boolean, default: false },
  flagReason: String,
}, { timestamps: true });

ReviewSchema.index({ providerId: 1, isVisible: 1, createdAt: -1 });
ReviewSchema.index({ customerId: 1, createdAt: -1 });

// Update provider rating after review save
ReviewSchema.post('save', async function () {
  // SCALE FIX: Debounce — only recalculate if not already recalculating for this provider
  // Use a fire-and-forget approach with a 2s delay to batch rapid reviews
  const providerId = this.providerId;
  setTimeout(async () => {
    try {
      const Provider = mongoose.model('Provider');
      const stats = await mongoose.model('Review').aggregate([
        { $match: { providerId, isVisible: true } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]).option({ maxTimeMS: 5000, allowDiskUse: true });
      if (stats.length > 0) {
        await Provider.findByIdAndUpdate(providerId, {
          rating: Math.round(stats[0].avgRating * 10) / 10,
          ratingCount: stats[0].count,
        });
      }
    } catch (err) {
      // Non-critical: rating update failure shouldn't crash the system
      mongoose.model('Review').schema.emit && console.warn('[Review] Rating recalc failed:', err.message);
    }
  }, 2000);
});


// ══════════════════════════════════════════════════════════════════════════════
// COMPLAINT MODEL
// ══════════════════════════════════════════════════════════════════════════════
const ComplaintSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  againstUser: { type: mongoose.Schema.Types.ObjectId },    // Customer or Provider
  againstRole: { type: String, enum: ['customer', 'provider'] },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Staff handling complaint

  category: {
    type: String,
    enum: [
      'overcharging',
      'poor_quality',
      'no_show',
      'behaviour',
      'damage',
      'safety',
      'fraud',
      'other',
    ],
    required: true,
  },
  description: { type: String, required: true, maxlength: 1000 },
  evidence: [String], // S3 URLs

  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: {
    type: String,
    enum: [
      'open',
      'in_review',
      'resolution_submitted',
      'more_information_required',
      'resolution_rejected',
      'resolved',
      'escalated',
      'closed',
    ],
    default: 'open',
    index: true,
  },

  // Resolution workflow fields
  resolutionResponse: String,
  resolutionEvidence: [String],
  resolutionSubmittedAt: Date,
  adminFeedback: String,
  adminMessage: String,
  infoRequestedAt: Date,
  rejectedAt: Date,

  resolution: {
    action: String,
    refundAmount: Number,
    note: String,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },

  escalations: [{
    escalatedTo: String,
    escalatedAt: Date,
    reason: String,
  }],

  comments: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: String,
    text: String,
    createdAt: { type: Date, default: Date.now },
  }],

  autoFlagged: { type: Boolean, default: false },
  fraudRisk: { type: Number, default: 0 },
}, { timestamps: true });

ComplaintSchema.pre('save', async function (next) {
  if (!this.ticketNumber) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
    this.ticketNumber = `CMP${ts}${rand}`;
  }
  next();
});

// SCALE: Compound indexes for fraud detection and complaint routing
ComplaintSchema.index({ againstUser: 1, createdAt: -1 });              // Fraud: complaints per provider
ComplaintSchema.index({ againstUser: 1, category: 1, status: 1 });     // Overcharging detection
ComplaintSchema.index({ severity: 1, status: 1, createdAt: -1 });      // Admin complaint triage
ComplaintSchema.index({ assignedTo: 1, status: 1 });                   // Staff my-complaints view

// ══════════════════════════════════════════════════════════════════════════════
// WALLET LEDGER MODEL
// ══════════════════════════════════════════════════════════════════════════════
const WalletLedgerSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  ownerType: { type: String, enum: ['customer', 'provider'], required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  account: { type: String, enum: ['wallet', 'security_deposit'], default: 'wallet' },
  amount: { type: Number, required: true, min: 0 },
  balance: { type: Number, required: true }, // Balance after this transaction
  description: { type: String, required: true },
  referenceType: String, // 'booking', 'refund', 'settlement', etc.
  referenceId: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

// ══════════════════════════════════════════════════════════════════════════════
// COUPON MODEL
// ══════════════════════════════════════════════════════════════════════════════
const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  description: String,
  discountType: { type: String, enum: ['flat', 'percent'], required: true },
  discountValue: { type: Number, required: true },
  maxDiscount: Number,           // For percent type
  minOrderValue: { type: Number, default: 0 },
  usageLimit: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  userLimit: { type: Number, default: 1 }, // Per user
  validFrom: { type: Date, required: true },
  validTo: { type: Date, required: true },
  applicableServices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  isActive: { type: Boolean, default: true },
  usedBy: [{ userId: mongoose.Schema.Types.ObjectId, usedAt: Date }],
}, { timestamps: true });

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION MODEL
// ══════════════════════════════════════════════════════════════════════════════
const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'booking_update', 'payment', 'otp', 'chat',
      'promotional', 'system', 'review', 'complaint', 'announcement',
    ],
  },
  isBroadcast: { type: Boolean, default: false },
  referenceType: String,
  referenceId: mongoose.Schema.Types.ObjectId,
  isRead: { type: Boolean, default: false },
  channels: {
    push: { sent: Boolean, sentAt: Date },
    sms: { sent: Boolean, sentAt: Date },
    email: { sent: Boolean, sentAt: Date },
  },
}, { timestamps: true });

NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days TTL auto-cleanup

// ══════════════════════════════════════════════════════════════════════════════
// COMPANY & WORKFORCE HIERARCHY MODELS
// ══════════════════════════════════════════════════════════════════════════════

// 1. Department Schema
const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, uppercase: true },
  description: String,
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  branch: { type: String, default: 'Headquarters' },
  monthlyTarget: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// 2. Team Schema (Enhanced)
const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, uppercase: true },
  city: String,
  department: String,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  teamLeaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  branch: { type: String, default: 'Headquarters' },
  description: String,
  monthlyTarget: { type: Number, default: 0 },
  completedTarget: { type: Number, default: 0 },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  transferHistory: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromTeam: String,
    toTeam: String,
    transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transferredAt: { type: Date, default: Date.now },
    reason: String,
  }],
}, { timestamps: true });

// 3. Custom Role & Permission Schema
const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, lowercase: true },
  description: String,
  permissions: [{ type: String }],
  isCustom: { type: Boolean, default: true },
}, { timestamps: true });

// 4. Company Task Schema
const StaffTaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  department: String,
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: { type: String, enum: ['pending', 'assigned', 'in_progress', 'waiting', 'completed', 'cancelled'], default: 'pending', index: true },
  dueDate: Date,
  comments: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now },
  }],
  checklist: [{ text: String, done: { type: Boolean, default: false } }],
}, { timestamps: true });

// 5. Targets & Goals Schema
const TargetSchema = new mongoose.Schema({
  title: { type: String, required: true },
  targetType: {
    type: String,
    enum: ['revenue', 'bookings', 'complaints_resolved', 'calls_completed', 'ratings', 'tasks', 'leads', 'sales', 'service_completion'],
    required: true,
  },
  period: { type: String, enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'], default: 'monthly' },
  targetValue: { type: Number, required: true },
  currentValue: { type: Number, default: 0 },
  assignedType: { type: String, enum: ['company', 'department', 'team', 'employee'], default: 'team' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, refPath: 'assignedModel' },
  assignedModel: { type: String, enum: ['User', 'Team', 'Department'], default: 'Team' },
  teamName: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
  status: { type: String, enum: ['active', 'completed', 'failed'], default: 'active' },
}, { timestamps: true });

// 6. Company Announcements Schema
const CompanyAnnouncementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
  audience: { type: String, enum: ['all', 'department', 'team', 'managers'], default: 'all' },
  targetId: mongoose.Schema.Types.ObjectId,
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPinned: { type: Boolean, default: false },
  expiryDate: Date,
  attachments: [String],
}, { timestamps: true });

// 7. Internal Meetings Schema
const CompanyMeetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  time: { type: String, required: true }, // HH:mm
  location: { type: String, default: 'Conference Room / Online' },
  meetingLink: String,
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  agenda: String,
  notes: String,
  status: { type: String, enum: ['scheduled', 'ongoing', 'completed', 'cancelled'], default: 'scheduled' },
}, { timestamps: true });

// 8. Company Internal Chat Message Schema
const StaffChatMessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  chatType: { type: String, enum: ['direct', 'team', 'department', 'manager', 'announcement'], default: 'direct' },
  targetId: { type: mongoose.Schema.Types.ObjectId, index: true }, // teamId / departmentId / userId
  message: { type: String, required: true },
  attachments: [String],
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

// 9. Staff Leave & Request Schema
const StaffRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['leave', 'wfh', 'permission', 'shift_change', 'team_transfer', 'equipment', 'salary_doc'],
    required: true,
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: String,
}, { timestamps: true });

// 10. Company Global Settings Schema
const CompanyConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  companyName: { type: String, default: 'ONEWAYFIX' },
  logoUrl: { type: String, default: '/logo.png' },
  description: { type: String, default: 'Leading On-Demand Home Services & Workforce Organization' },
  workingHours: { type: String, default: '09:00 AM - 06:00 PM' },
  workingDays: [{ type: String }],
  holidays: [{ date: String, name: String }],
  branches: [{ name: String, city: String, address: String }],
  designations: [{ type: String }],
  policies: [{ title: String, content: String }],
}, { timestamps: true });

// 11. Attendance Schema
const AttendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  userModel: { type: String, enum: ['User', 'Provider'], default: 'User' },
  date: { type: String, required: true }, // YYYY-MM-DD
  checkIn: Date,
  checkOut: Date,
  status: { type: String, enum: ['present', 'absent', 'late', 'half_day', 'leave', 'wfh'], default: 'present' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number],
  },
}, { timestamps: true });

// ══════════════════════════════════════════════════════════════════════════════
// SYSTEM SETTINGS MODEL (Bagisto / Shopify Style Dynamic Site Management)
// ══════════════════════════════════════════════════════════════════════════════
const BrandingAssetSchema = new mongoose.Schema({
  url: { type: String, default: null },
  key: { type: String, default: null },
  updatedAt: { type: Date, default: null },
}, { _id: false });

const SystemSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  siteName: { type: String, default: 'ServiceHub' },
  logoUrl: { type: String, default: '/logo.png' },   // legacy — kept for backward compat
  faviconUrl: { type: String, default: '/logo.svg' }, // legacy — kept for backward compat

  // ── S3 Branding Assets (single source of truth) ──────────────────────────
  branding: {
    logo:        { type: BrandingAssetSchema, default: () => ({}) },
    favicon:     { type: BrandingAssetSchema, default: () => ({}) },
    darkLogo:    { type: BrandingAssetSchema, default: () => ({}) },
    appIcon:     { type: BrandingAssetSchema, default: () => ({}) },
    loginLogo:   { type: BrandingAssetSchema, default: () => ({}) },
    invoiceLogo: { type: BrandingAssetSchema, default: () => ({}) },
  },
  tagline: { type: String, default: 'Premium Home Services at your Doorstep' },
  currencySymbol: { type: String, default: '₹' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  defaultRadius: { type: Number, default: 25 },
  supportPhone: { type: String, default: '+91 9876543210' },
  supportEmail: { type: String, default: 'support@servicehub.com' },
  supportAddress: { type: String, default: 'ServiceHub HQ, Hitech City, Hyderabad 500081' },
  workingHours: { type: String, default: '8:00 AM - 10:00 PM' },
  gstRate: { type: Number, default: 18 },
  platformFee: { type: Number, default: 49 },
  plusPrice: { type: Number, default: 299 },
  plusPrice6Months: { type: Number, default: 299 },
  plusPrice1Year: { type: Number, default: 499 },
  subscriptionModelActive: { type: Boolean, default: true },
  announcementText: { type: String, default: '🎉 Special Launch Offer: Get 20% OFF on your first booking! Code: FIRST20' },
  announcementActive: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  allowBookings: { type: Boolean, default: true },
  
  // Social Media Links
  facebookUrl: { type: String, default: 'https://facebook.com' },
  instagramUrl: { type: String, default: 'https://instagram.com' },
  twitterUrl: { type: String, default: 'https://twitter.com' },
  youtubeUrl: { type: String, default: 'https://youtube.com' },
  whatsappNumber: { type: String, default: '+91 9876543210' },

  // Mobile App Download Links
  apkDownloadUrl: { type: String, default: '/downloads/servicehub.apk' },
  playStoreUrl: { type: String, default: '' },
  appStoreUrl: { type: String, default: '' },

  // Provider Commission & Settlement Policy
  defaultCommissionRate: { type: Number, default: 20 }, // %
  minSettlementAmount: { type: Number, default: 500 }, // ₹
  maxCommissionDebtLimit: { type: Number, default: 2000 }, // ₹ limit before auto-hold
  autoApproveKyc: { type: Boolean, default: false },

  // SEO & Meta Configuration
  metaTitle: { type: String, default: 'ServiceHub — On-Demand Home Services & Maintenance' },
  metaDescription: { type: String, default: 'Book verified electricians, plumbers, AC technicians, and home cleaning experts instantly.' },
  metaKeywords: { type: String, default: 'home services, electrician, plumber, AC repair, cleaning, ServiceHub' },
  googleAnalyticsId: { type: String, default: '' },

  // Legal & Terms Policy Text
  termsContent: { type: String, default: 'Standard terms of service apply to all users and service providers on ServiceHub.' },
  privacyContent: { type: String, default: 'ServiceHub respects user privacy and secures data with end-to-end encryption.' },
  refundContent: { type: String, default: 'Full refund provided for cancellations made at least 2 hours prior to scheduled slot.' },

  promoBanners: [{
    label: String,
    desc: String,
    tag: String,
    bg: String,
    icon: String,
    category: String,
    active: { type: Boolean, default: true },
  }],
  categoryBanners: [{
    category: { type: String, required: true },
    heroImage: { type: String, default: '' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    badge: { type: String, default: '' },
    active: { type: Boolean, default: true },
  }],
  videoSpotlights: [{
    video: String,
    title: String,
    desc: String,
    badge: String,
    cta: String,
    category: String,
    active: { type: Boolean, default: true },
  }],
}, { timestamps: true });

// ══════════════════════════════════════════════════════════════════════════════
// INVOICE SETTINGS MODEL
// ══════════════════════════════════════════════════════════════════════════════
const InvoiceSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  
  // 1. General Company Settings
  companyName: { type: String, default: 'ONEWAYFIX' },
  brandTagline: { type: String, default: 'Premium Home Services' },
  website: { type: String, default: 'www.onewayfix.com' },
  supportEmail: { type: String, default: 'support@onewayfix.com' },
  supportPhone: { type: String, default: '+91 9876543210' },
  companyAddress: { type: String, default: 'OneWayFix HQ, Hitech City, Hyderabad, TG 500081' },
  gstin: { type: String, default: '36ABCDE1234F1Z5' },
  cin: { type: String, default: 'U74999TG2026PTC123456' },
  logoUrl: { type: String, default: '/logo.png' },
  invoiceTitle: { type: String, default: 'INVOICE' },

  // 2. GST & Tax Settings
  gstEnabled: { type: Boolean, default: true },
  gstMode: { type: String, enum: ['included', 'added_separately', 'no_gst'], default: 'included' },
  taxCalculationMode: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  gstPercentage: { type: Number, default: 18 },
  cgstPercentage: { type: Number, default: 9 },
  sgstPercentage: { type: Number, default: 9 },
  igstPercentage: { type: Number, default: 18 },
  
  gstAppliesTo: {
    serviceCharge: { type: Boolean, default: true },
    platformFee: { type: Boolean, default: true },
    technicianCharge: { type: Boolean, default: true },
    partsMaterials: { type: Boolean, default: true },
    convenienceFee: { type: Boolean, default: false },
    emergencyFee: { type: Boolean, default: false },
    otherCharges: { type: Boolean, default: false },
  },

  // 3. GST Display Options
  showGst: { type: Boolean, default: true },
  showCgst: { type: Boolean, default: true },
  showSgst: { type: Boolean, default: true },
  showIgst: { type: Boolean, default: false },
  showGstin: { type: Boolean, default: true },
  
  labelGst: { type: String, default: 'GST' },
  labelCgst: { type: String, default: 'CGST' },
  labelSgst: { type: String, default: 'SGST' },
  labelIgst: { type: String, default: 'IGST' },
  labelTax: { type: String, default: 'Tax' },

  // 4. Charges Configuration
  charges: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    type: { type: String, enum: ['percentage', 'fixed', 'actual'], default: 'fixed' },
    value: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
  }],

  // 5. Invoice Numbering
  numbering: {
    prefix: { type: String, default: 'OWF-INV-' },
    startingNumber: { type: Number, default: 100001 },
    numberLength: { type: Number, default: 6 },
    includeYear: { type: Boolean, default: false },
    includeMonth: { type: Boolean, default: false },
    nextNumber: { type: Number, default: 100001 },
  },

  // 6. PDF Design & Colors
  design: {
    layout: { type: String, enum: ['modern', 'classic', 'minimal', 'professional', 'compact'], default: 'modern' },
    paperSize: { type: String, enum: ['A4', 'A5', 'Thermal'], default: 'A4' },
    orientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' },
    primaryColor: { type: String, default: '#0f766e' },
    secondaryColor: { type: String, default: '#0d9488' },
    headerBg: { type: String, default: '#ccfbf1' },
    footerBg: { type: String, default: '#ccfbf1' },
    tableHeaderColor: { type: String, default: '#1e293b' },
    tableBorderColor: { type: String, default: '#cbd5e1' },
    totalHighlightColor: { type: String, default: '#0f766e' },
    guaranteeCardBg: { type: String, default: '#ecfdf5' },
    guaranteeBorderColor: { type: String, default: '#059669' },
    textColor: { type: String, default: '#1e293b' },
    fontFamily: { type: String, default: 'Helvetica' },
    logoWidth: { type: Number, default: 120 },
    logoAlignment: { type: String, enum: ['left', 'center', 'right'], default: 'right' },
  },

  // 7. Sections Visibility & Order
  sections: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  }],

  // 8. Bill To / Bill From Display Fields
  technicianFields: {
    showName: { type: Boolean, default: true },
    showEmployeeId: { type: Boolean, default: true },
    showPhone: { type: Boolean, default: true },
    showCategory: { type: Boolean, default: true },
    showRating: { type: Boolean, default: true },
    showGstin: { type: Boolean, default: false },
  },
  customerFields: {
    showName: { type: Boolean, default: true },
    showPhone: { type: Boolean, default: true },
    showEmail: { type: Boolean, default: true },
    showAddress: { type: Boolean, default: true },
    showCustomerId: { type: Boolean, default: false },
    showGstin: { type: Boolean, default: false },
  },

  // 9. Guarantee Settings
  guarantee: {
    enabled: { type: Boolean, default: true },
    duration: { type: Number, default: 1 },
    unit: { type: String, enum: ['Days', 'Weeks', 'Months'], default: 'Months' },
    title: { type: String, default: '1-MONTH SERVICE GUARANTEE' },
    description: { type: String, default: 'Your completed service is covered by a 1-month service guarantee, subject to OneWayFix service terms and applicable conditions.' },
  },

  // 10. Work Summary & Payment Display
  workSummary: {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: 'WORK SUMMARY' },
    defaultMessage: { type: String, default: 'Job completed successfully according to service checklist.' },
  },
  paymentDisplay: {
    showPaymentMethod: { type: Boolean, default: true },
    showTransactionId: { type: Boolean, default: true },
    showPaymentStatus: { type: Boolean, default: true },
    showPaymentDate: { type: Boolean, default: true },
    showAmountPaid: { type: Boolean, default: true },
    showAmountDue: { type: Boolean, default: true },
  },

  // 11. QR Code Settings
  qrCode: {
    enabled: { type: Boolean, default: true },
    type: { type: String, enum: ['UPI', 'Invoice Verification URL', 'Payment URL', 'Custom URL'], default: 'Invoice Verification URL' },
    caption: { type: String, default: 'Scan to Verify Invoice' },
  },

  // 12. Footer & Support Settings
  footer: {
    thankYouTitle: { type: String, default: 'THANK YOU!' },
    thankYouMessage: { type: String, default: 'Thank you for choosing OneWayFix for your home service needs. We appreciate your trust and look forward to serving you again.' },
    termsText: { type: String, default: 'This is a computer-generated invoice. No signature required. Terms & conditions apply.' },
  },

  // Settings Version
  settingsVersion: { type: Number, default: 1 },
}, { timestamps: true });

// ══════════════════════════════════════════════════════════════════════════════
// INVOICE SNAPSHOT MODEL
// ══════════════════════════════════════════════════════════════════════════════
const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  
  companySnapshot: mongoose.Schema.Types.Mixed,
  customerSnapshot: mongoose.Schema.Types.Mixed,
  technicianSnapshot: mongoose.Schema.Types.Mixed,
  serviceItems: [{
    name: String,
    qty: { type: Number, default: 1 },
    price: Number,
    total: Number,
  }],

  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  taxableAmount: { type: Number, default: 0 },
  gstEnabled: { type: Boolean, default: true },
  gstMode: { type: String, default: 'included' },
  gstRate: { type: Number, default: 18 },
  gstAmount: { type: Number, default: 0 },
  cgstAmount: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },

  platformFee: { type: Number, default: 0 },
  serviceCharge: { type: Number, default: 0 },
  partsAmount: { type: Number, default: 0 },
  additionalCharges: { type: Number, default: 0 },

  totalAmount: { type: Number, required: true },
  amountPaid: { type: Number, required: true },
  amountDue: { type: Number, default: 0 },

  paymentMethod: String,
  transactionId: String,
  paymentStatus: String,

  guaranteeEnabled: { type: Boolean, default: true },
  guaranteeTitle: String,
  guaranteeText: String,

  settingsVersion: { type: Number, default: 1 },
  settingsSnapshot: mongoose.Schema.Types.Mixed,
  pdfUrl: String,
}, { timestamps: true });

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG MODEL
// ══════════════════════════════════════════════════════════════════════════════
const AuditLogSchema = new mongoose.Schema({
  action: { type: String, required: true, index: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', index: true },
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', index: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  previousStatus: String,
  newStatus: String,
  reason: String,
  details: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

AuditLogSchema.index({ providerId: 1, createdAt: -1 });
AuditLogSchema.index({ complaintId: 1, createdAt: -1 });

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
  User: mongoose.model('User', UserSchema),
  Provider: mongoose.model('Provider', ProviderSchema),
  Service: mongoose.model('Service', ServiceSchema),
  Booking: mongoose.model('Booking', BookingSchema),
  MaterialsUsed: mongoose.model('MaterialsUsed', MaterialsUsedSchema),
  Transaction: mongoose.model('Transaction', TransactionSchema),
  Review: mongoose.model('Review', ReviewSchema),
  Complaint: mongoose.model('Complaint', ComplaintSchema),
  WalletLedger: mongoose.model('WalletLedger', WalletLedgerSchema),
  Coupon: mongoose.model('Coupon', CouponSchema),
  Notification: mongoose.model('Notification', NotificationSchema),
  Department: mongoose.model('Department', DepartmentSchema),
  Team: mongoose.model('Team', TeamSchema),
  Role: mongoose.model('Role', RoleSchema),
  StaffTask: mongoose.model('StaffTask', StaffTaskSchema),
  Target: mongoose.model('Target', TargetSchema),
  CompanyAnnouncement: mongoose.model('CompanyAnnouncement', CompanyAnnouncementSchema),
  CompanyMeeting: mongoose.model('CompanyMeeting', CompanyMeetingSchema),
  StaffChatMessage: mongoose.model('StaffChatMessage', StaffChatMessageSchema),
  StaffRequest: mongoose.model('StaffRequest', StaffRequestSchema),
  CompanyConfig: mongoose.model('CompanyConfig', CompanyConfigSchema),
  Attendance: mongoose.model('Attendance', AttendanceSchema),
  SystemSettings: mongoose.model('SystemSettings', SystemSettingsSchema),
  InvoiceSettings: mongoose.model('InvoiceSettings', InvoiceSettingsSchema),
  Invoice: mongoose.model('Invoice', InvoiceSchema),
  AuditLog: mongoose.model('AuditLog', AuditLogSchema),
};
