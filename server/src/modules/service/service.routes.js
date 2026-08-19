'use strict';
const express = require('express');
const mongoose = require('mongoose');
const { Service } = require('../../models');
const { cache } = require('../../config/redis');
const router = express.Router();

// Category image & icon map (matches frontend public assets)
const CATEGORY_META = {
  'AC Repair':        { img: '/cat_ac.png',        icon: '❄️',  color: '#0284c7' },
  'Cleaning':         { img: '/cat_cleaning.png',  icon: '🧹',  color: '#059669' },
  'Washing Machine':  { img: '/cat_washing.png',   icon: '🫧',  color: '#3b82f6' },
  'Fridge & Cooler':  { img: '/cat_fridge.png',    icon: '🧊',  color: '#0ea5e9' },
  'Plumbing':         { img: '/cat_plumbing.png',  icon: '🔧',  color: '#475569' },
  'Electrical':       { img: '/cat_electrical.png',icon: '⚡',  color: '#d97706' },
  'Pest Control':     { img: '/cat_pest.png',       icon: '🐛',  color: '#65a30d' },
  'Carpentry':        { img: '/cat_carpentry.png', icon: '🪚',  color: '#ea580c' },
  'Painting':         { img: '/cat_painting.png',  icon: '🎨',  color: '#db2777' },
  'Salon':            { img: '/cat_salon.png',      icon: '💇',  color: '#7c3aed' },
};

/**
 * GET /services
 * Returns all active services, optionally filtered by category & search
 * Supports sort: price_asc, price_desc, popular (default)
 */
router.get('/', async (req, res) => {
  const { category, search, sort = 'popular' } = req.query;
  const cacheKey = `services:${category || 'all'}:${search || ''}:${sort}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const filter = { isActive: true };
  if (category) filter.category = category;
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { tags: { $in: [new RegExp(search, 'i')] } },
    { description: { $regex: search, $options: 'i' } },
  ];

  const sortMap = {
    price_asc: { basePrice: 1 },
    price_desc: { basePrice: -1 },
    popular: { popularityScore: -1, sortOrder: 1 },
  };

  const services = await Service.find(filter)
    .sort(sortMap[sort] || sortMap.popular)
    .lean();

  await cache.set(cacheKey, services, 300);
  res.json({ success: true, data: services });
});

/**
 * GET /services/categories
 * Returns rich category list from Category model with service counts
 */
router.get('/categories', async (req, res) => {
  const cacheKey = 'service:categories:rich:v2';
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached });

  const { Category } = require('../../models');
  let dbCategories = await Category.find({ status: 'active', isArchived: false }).sort({ sortOrder: 1 }).lean();

  // Aggregate service count per category
  const counts = await Service.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map(c => [c._id, c.count]));

  if (dbCategories && dbCategories.length > 0) {
    const formatted = dbCategories.map(cat => ({
      _id: cat._id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon || '🛠️',
      img: cat.image || CATEGORY_META[cat.name]?.img || '/cat_ac.png',
      color: cat.color || CATEGORY_META[cat.name]?.color || '#3b82f6',
      shortDescription: cat.shortDescription || '',
      serviceCount: countMap[cat.name] || 0,
      sortOrder: cat.sortOrder,
    }));
    await cache.set(cacheKey, formatted, 600);
    return res.json({ success: true, data: formatted });
  }

  // Merge default CATEGORY_META keys with DB categories as fallback
  const categoryNames = Array.from(new Set([...Object.keys(CATEGORY_META), ...Object.keys(countMap)]));
  const categories = categoryNames.map(name => ({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    serviceCount: countMap[name] || 0,
    ...(CATEGORY_META[name] || {
      img: '/cat_ac.png',
      icon: '🛠️',
      color: '#3b82f6'
    }),
  }));

  await cache.set(cacheKey, categories, 600);
  res.json({ success: true, data: categories });
});

/**
 * GET /services/categories/:idOrSlug/service-types
 * Returns active service types for a given category ID or Slug
 */
router.get('/categories/:idOrSlug/service-types', async (req, res) => {
  const { idOrSlug } = req.params;
  const { Category, ServiceType } = require('../../models');

  let category;
  if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
    category = await Category.findById(idOrSlug).lean();
  }
  if (!category) {
    category = await Category.findOne({
      $or: [
        { slug: idOrSlug.toLowerCase() },
        { name: { $regex: new RegExp(`^${idOrSlug.replace(/-/g, ' ')}$`, 'i') } }
      ]
    }).lean();
  }

  if (!category) {
    return res.json({ success: true, data: [] });
  }

  const serviceTypes = await ServiceType.find({
    categoryId: category._id,
    status: 'active',
    isArchived: false,
  }).sort({ sortOrder: 1 }).lean();

  res.json({ success: true, category, data: serviceTypes });
});

/**
 * GET /services/service-types
 * Returns all active service types across categories
 */
router.get('/service-types', async (req, res) => {
  const { categoryId, categorySlug } = req.query;
  const { ServiceType } = require('../../models');
  const filter = { status: 'active', isArchived: false };
  if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) filter.categoryId = categoryId;
  if (categorySlug) filter.categorySlug = categorySlug.toLowerCase();

  const types = await ServiceType.find(filter).populate('categoryId', 'name slug icon').sort({ sortOrder: 1 }).lean();
  res.json({ success: true, data: types });
});

/**
 * GET /services/public-settings
 * Returns public site settings (siteName, logoUrl, tagline, videoSpotlights, branding).
 * Effective logo/favicon URLs prefer S3-backed branding assets over legacy URL fields.
 */
router.get('/public-settings', async (req, res) => {
  try {
    const { SystemSettings } = require('../../models');
    let settings = await SystemSettings.findOne({ key: 'global' }).lean();
    if (!settings) {
      settings = {
        siteName: 'OneWayFix',
        logoUrl: '/logo.png',
        faviconUrl: '/logo.svg',
        tagline: 'Premium Home Services at your Doorstep',
        videoSpotlights: [],
        branding: {},
      };
    }

    // Resolve effective URLs: S3 branding > legacy field > default
    const b = settings.branding || {};
    const effectiveLogo    = b.logo?.url    || settings.logoUrl    || '/logo.png';
    const effectiveFavicon = b.favicon?.url || settings.faviconUrl || '/logo.svg';

    // Add timestamps to branding URLs for cache-busting
    const cacheBust = (url, asset) => {
      if (!url || url.startsWith('/')) return url; // local static — no cache-bust needed
      const ts = asset?.updatedAt ? new Date(asset.updatedAt).getTime() : Date.now();
      return url.includes('?') ? `${url}&v=${ts}` : `${url}?v=${ts}`;
    };

    res.json({
      success: true,
      data: {
        ...settings,
        // Override logo/favicon with effective URLs for backward compat
        logoUrl:    cacheBust(effectiveLogo,    b.logo),
        faviconUrl: cacheBust(effectiveFavicon, b.favicon),
        // Include full resolved branding map for frontend use
        branding: {
          logo:        cacheBust(effectiveLogo,     b.logo),
          favicon:     cacheBust(effectiveFavicon,  b.favicon),
          darkLogo:    cacheBust(b.darkLogo?.url    || null, b.darkLogo),
          appIcon:     cacheBust(b.appIcon?.url     || null, b.appIcon),
          loginLogo:   cacheBust(b.loginLogo?.url   || null, b.loginLogo),
          invoiceLogo: cacheBust(b.invoiceLogo?.url || null, b.invoiceLogo),
        },
      },
    });
  } catch (err) {
    res.json({
      success: true,
      data: {
        siteName: 'OneWayFix',
        logoUrl: '/logo.png',
        faviconUrl: '/logo.svg',
        tagline: 'Premium Home Services at your Doorstep',
        videoSpotlights: [],
        branding: {},
      },
    });
  }
});


/**
 * GET /services/options/catalog
 * Returns category options / rate cards for on-site quotations (e.g. Gas Leak, PCB Repair)
 */
router.get('/options/catalog', async (req, res) => {
  const { category } = req.query;
  const filter = { isActive: true };
  if (category) filter.category = category;

  const services = await Service.find(filter).select('name category subcategory basePrice serviceType categoryOptions').lean();
  
  const rateCardItems = [];
  services.forEach(s => {
    if (s.categoryOptions && s.categoryOptions.length > 0) {
      s.categoryOptions.forEach(opt => {
        rateCardItems.push({
          serviceId: s._id,
          serviceName: s.name,
          category: s.category,
          name: opt.optionName,
          basePrice: opt.fixedPrice,
          description: opt.description,
        });
      });
    } else {
      rateCardItems.push({
        serviceId: s._id,
        serviceName: s.name,
        category: s.category,
        name: `${s.name} - Standard Fix`,
        basePrice: s.basePrice,
      });
    }
  });

  res.json({ success: true, count: rateCardItems.length, data: rateCardItems });
});

/**
 * GET /services/slug/:slug
 * Returns a single service by SEO slug (e.g. ac-repair)
 */
router.get('/slug/:slug', async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const service = await Service.findOne({ slug, isActive: true }).lean();
  if (!service) {
    // Fallback: try regex search on name
    const fallback = await Service.findOne({
      name: { $regex: new RegExp(`^${slug.replace(/-/g, ' ')}$`, 'i') },
      isActive: true,
    }).lean();
    if (!fallback) return res.status(404).json({ success: false, error: 'Service not found' });
    return res.json({ success: true, data: fallback });
  }
  res.json({ success: true, data: service });
});

/**
 * GET /services/:id
 * Returns a single service by ID
 */
router.get('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ success: false, error: 'Service not found' });
  }
  const service = await Service.findById(req.params.id).lean();
  if (!service) return res.status(404).json({ success: false, error: 'Service not found' });
  res.json({ success: true, data: service });
});

module.exports = router;
