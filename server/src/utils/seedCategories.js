'use strict';
const mongoose = require('mongoose');
const { Category, ServiceType, Service } = require('../models');
const logger = require('./logger');

const CATEGORIES_DATA = [
  {
    name: 'AC Repair & Services',
    slug: 'ac-repair-services',
    icon: '❄️',
    color: '#0284c7',
    shortDescription: 'Complete AC servicing, deep cleaning, gas refill & repairs',
    sortOrder: 1,
    serviceTypes: [
      'Normal AC Service',
      'AC Deep Cleaning',
      'AC Installation',
      'AC Uninstallation',
      'AC Gas Charging',
      'AC Gas Leak Detection',
      'AC Cooling Problem',
      'AC Water Leakage',
      'AC Not Starting',
      'AC Noise/Vibration',
      'PCB Repair',
      'PCB Replacement',
      'Compressor Repair',
      'Compressor Replacement',
      'Fan Motor Repair',
      'Fan Motor Replacement',
      'Capacitor Replacement',
      'Drain Pipe Repair',
      'Copper Pipe Repair',
      'AC Remote Repair/Replacement',
      'Thermostat Repair',
      'Sensor Replacement',
      'Electrical Fault Repair',
      'AC Inspection/Diagnosis',
    ],
  },
  {
    name: 'Refrigerator Repair',
    slug: 'refrigerator-repair',
    icon: '🧊',
    color: '#0ea5e9',
    shortDescription: 'Fridge cooling repair, gas charging, compressor & thermostat replacement',
    sortOrder: 2,
    serviceTypes: [
      'Single Door Refrigerator Repair',
      'Double Door Refrigerator Repair',
      'Side-by-Side Refrigerator Repair',
      'Refrigerator Gas Charging',
      'Thermostat Replacement',
      'Compressor Repair/Replacement',
    ],
  },
  {
    name: 'Washing Machine Repair',
    slug: 'washing-machine-repair',
    icon: '🫧',
    color: '#3b82f6',
    shortDescription: 'Front load, top load & semi-automatic washing machine repair & installation',
    sortOrder: 3,
    serviceTypes: [
      'Top Load Washing Machine Repair',
      'Front Load Washing Machine Repair',
      'Semi-Automatic Washing Machine Repair',
      'Washing Machine Installation',
      'Drum Repair / Bearing Replacement',
      'Drain Pump Repair',
    ],
  },
  {
    name: 'Geyser Repair',
    slug: 'geyser-repair',
    icon: '🔥',
    color: '#ef4444',
    shortDescription: 'Electric & gas geyser installation, element & thermostat repair',
    sortOrder: 4,
    serviceTypes: [
      'Electric Geyser Repair',
      'Gas Geyser Repair',
      'Geyser Installation',
      'Heating Element Replacement',
      'Thermostat Repair',
    ],
  },
  {
    name: 'RO & Water Purifier',
    slug: 'ro-water-purifier',
    icon: '💧',
    color: '#06b6d4',
    shortDescription: 'RO filter replacement, membrane change & water purifier repair',
    sortOrder: 5,
    serviceTypes: [
      'RO Service & Filter Change',
      'RO Repair & Diagnosis',
      'RO Installation / Uninstallation',
      'Membrane Replacement',
    ],
  },
  {
    name: 'Electrician',
    slug: 'electrician',
    icon: '⚡',
    color: '#d97706',
    shortDescription: 'Wiring, MCB fitting, switchboards, fan repair & light installations',
    sortOrder: 6,
    serviceTypes: [
      'Switch & Socket Repair',
      'Fan Repair & Installation',
      'Wiring & Short Circuit Fix',
      'MCB & Fuse Repair',
      'Light & Chandelier Fitting',
    ],
  },
  {
    name: 'Plumbing',
    slug: 'plumbing',
    icon: '🔧',
    color: '#475569',
    shortDescription: 'Tap leak repair, pipeline unclogging, cistern fix & water tank cleaning',
    sortOrder: 7,
    serviceTypes: [
      'Tap & Mixer Repair',
      'Toilet & Cistern Repair',
      'Blocked Pipe Unclogging',
      'Water Tank Cleaning',
      'Pipe Fitting & Leakage Fix',
    ],
  },
  {
    name: 'Home Cleaning',
    slug: 'home-cleaning',
    icon: '🧹',
    color: '#059669',
    shortDescription: 'Full home deep cleaning, kitchen & bathroom sanitization',
    sortOrder: 8,
    serviceTypes: [
      'Full Home Deep Cleaning',
      'Bathroom Deep Cleaning',
      'Kitchen Deep Cleaning',
      'Sofa & Mattress Cleaning',
      'Carpet Cleaning',
    ],
  },
  {
    name: 'Carpentry',
    slug: 'carpentry',
    icon: '🪚',
    color: '#ea580c',
    shortDescription: 'Furniture assembly, door lock repair, cabinet & woodwork repair',
    sortOrder: 9,
    serviceTypes: [
      'Door & Lock Repair',
      'Furniture Repair & Assembly',
      'Cupboard & Drawer Fitting',
      'Wooden Flooring Repair',
    ],
  },
  {
    name: 'Painting',
    slug: 'painting',
    icon: '🎨',
    color: '#db2777',
    shortDescription: 'Interior & exterior wall painting, waterproofing & stencil designs',
    sortOrder: 10,
    serviceTypes: [
      'Interior Wall Painting',
      'Exterior Painting',
      'Waterproofing Treatment',
      'Texture & Stencil Painting',
    ],
  },
  {
    name: 'CCTV & Security',
    slug: 'cctv-security',
    icon: '🎥',
    color: '#6366f1',
    shortDescription: 'CCTV camera setup, DVR configuration & smart doorbell installation',
    sortOrder: 11,
    serviceTypes: [
      'CCTV Camera Installation',
      'CCTV Repair & Maintenance',
      'DVR/NVR Configuration',
      'Video Doorbell Installation',
    ],
  },
  {
    name: 'Appliance Installation',
    slug: 'appliance-installation',
    icon: '📺',
    color: '#8b5cf6',
    shortDescription: 'TV wall mounting, chimney setup, microwave & dishwasher fitting',
    sortOrder: 12,
    serviceTypes: [
      'TV Wall Mounting & Setup',
      'Chimney & Hob Installation',
      'Microwave Repair & Service',
      'Dishwasher Installation',
    ],
  },
];

async function seedCategoriesAndTypes() {
  logger.info('Starting Category & ServiceType Seeder...');
  
  for (const catData of CATEGORIES_DATA) {
    let category = await Category.findOne({
      $or: [{ slug: catData.slug }, { name: catData.name }]
    });

    if (!category) {
      category = await Category.create({
        name: catData.name,
        slug: catData.slug,
        icon: catData.icon,
        color: catData.color,
        shortDescription: catData.shortDescription,
        sortOrder: catData.sortOrder,
        status: 'active',
      });
      logger.info(`Created Category: ${category.name}`);
    } else {
      category.icon = catData.icon;
      category.color = catData.color;
      category.shortDescription = catData.shortDescription;
      category.sortOrder = catData.sortOrder;
      await category.save();
    }

    for (let i = 0; i < catData.serviceTypes.length; i++) {
      const stName = catData.serviceTypes[i];
      const stBaseSlug = stName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|const stBaseSlug = stName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+|-+$/g, ''); const stSlug = `${category.slug}-${stBaseSlug}`;
      const stSlug = \;

      let serviceType = await ServiceType.findOne({
        categoryId: category._id,
        $or: [{ slug: stSlug }, { name: stName }]
      });

      if (!serviceType) {
        serviceType = await ServiceType.create({
          categoryId: category._id,
          categorySlug: category.slug,
          name: stName,
          slug: stSlug,
          icon: catData.icon,
          sortOrder: i + 1,
          status: 'active',
        });
        logger.info(`  └─ Created ServiceType: ${serviceType.name}`);
      }
    }
  }

  // Backfill existing Services in DB to reference Category and ServiceType
  const services = await Service.find({});
  let updatedCount = 0;

  for (const s of services) {
    if (!s.category) continue;
    
    // Find matching category (fuzzy match by name or legacy category string)
    const category = await Category.findOne({
      $or: [
        { name: new RegExp(`^${s.category.replace(/[^a-zA-Z0-9]/g, '.*')}`, 'i') },
        { name: s.category }
      ]
    }) || await Category.findOne({ slug: 'ac-repair-services' }); // fallback

    if (category) {
      s.categoryId = category._id;
      s.category = category.name; // normalize category string name

      // Try to find matching service type from subcategory or service name
      const sub = s.subcategory || s.name;
      const serviceType = await ServiceType.findOne({
        categoryId: category._id,
        $or: [
          { name: new RegExp(sub.replace(/[^a-zA-Z0-9]/g, '.*'), 'i') },
          { name: { $regex: s.name, $options: 'i' } }
        ]
      });

      if (serviceType) {
        s.serviceTypeId = serviceType._id;
      }
      await s.save();
      updatedCount++;
    }
  }

  logger.info(`Category hierarchy seeder complete. ${updatedCount} existing services mapped to Category & ServiceType IDs.`);
}

module.exports = { seedCategoriesAndTypes };

if (require.main === module) {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/servicehub';
  mongoose.connect(MONGO_URI)
    .then(async () => {
      await seedCategoriesAndTypes();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
