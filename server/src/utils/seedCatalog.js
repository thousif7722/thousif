'use strict';
const mongoose = require('mongoose');
const { Category, ServiceType, Service } = require('../models');
const logger = require('./logger');

const FULL_CATALOG = [
  // 1. AC Repair & Services
  {
    name: 'AC Repair & Services',
    slug: 'ac-repair-services',
    icon: '❄️',
    color: '#0284c7',
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Complete AC servicing, foam jet deep cleaning, gas charging & PCB repairs',
    sortOrder: 1,
    serviceTypes: [
      {
        name: 'Normal AC Service',
        icon: '🧼',
        description: 'Routine AC filter wash, condenser coil cleaning, & cooling checkup',
        services: [
          { name: 'Split AC General Service', basePrice: 499, duration: 45, icon: '❄️', image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80', description: 'Filter cleaning, pressure wash, drain tube check and airflow inspection.' },
          { name: 'Window AC General Service', basePrice: 399, duration: 45, icon: '🖼️', image: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=800&q=80', description: 'Window unit filter wash, grill cleaning and amp reading verification.' },
          { name: 'Cassette AC Servicing', basePrice: 999, duration: 90, icon: '🏢', image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=800&q=80', description: 'Commercial & office cassette AC jet foam cleaning and grill wash.' },
        ]
      },
      {
        name: 'AC Deep Cleaning',
        icon: '🧽',
        description: 'High-pressure foam jet wash removing 99% dust, mold & allergens',
        services: [
          { name: 'Split AC Power Jet Foam Wash', basePrice: 799, duration: 60, icon: '🌊', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80', description: 'Deep foam chemical wash of indoor cooling coils and outdoor unit.' },
          { name: 'Anti-Rust Deep Cleaning Service', basePrice: 949, duration: 75, icon: '🛡️', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80', description: 'Foam jet wash with anti-fungal spray and anti-rust protective coating.' }
        ]
      },
      {
        name: 'AC Gas Charging',
        icon: '⛽',
        description: 'Leak detection, nitrogen testing & eco gas refill (R32, R410a, R22)',
        services: [
          { name: 'AC Full Gas Refill (R32/R410)', basePrice: 2499, duration: 60, icon: '💨', image: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=800&q=80', description: 'Complete vacuuming, leak check and gas refilling to manufacturer spec.' },
          { name: 'Gas Leakage Repair & Top Up', basePrice: 1499, duration: 45, icon: '🔍', image: 'https://images.unsplash.com/photo-1597733336794-12d05021d510?auto=format&fit=crop&w=800&q=80', description: 'Copper joint soldering, pressure testing and partial gas top-up.' }
        ]
      },
      {
        name: 'AC Installation & Removal',
        icon: '🛠️',
        description: 'Expert wall mounting, copper pipe fitting & safe dismantling',
        services: [
          { name: 'Split AC Installation', basePrice: 1299, duration: 90, icon: '📦', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80', description: 'Outdoor bracket mounting, indoor unit wall fit and vacuum testing.' },
          { name: 'Split AC Uninstallation', basePrice: 599, duration: 45, icon: '🔩', image: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80', description: 'Refrigerant pump down, bracket removal and safe packing.' }
        ]
      }
    ]
  },

  // 2. Washing Machine Repair
  {
    name: 'Washing Machine Repair',
    slug: 'washing-machine-repair',
    icon: '🫧',
    color: '#3b82f6',
    image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Front load, top load & semi-automatic washing machine repair & drum clean',
    sortOrder: 2,
    serviceTypes: [
      {
        name: 'Front Load Repair',
        icon: '🎛️',
        description: 'Door lock, drum bearing, motor & drain pump servicing for front load units',
        services: [
          { name: 'Front Load General Checkup & Repair', basePrice: 399, duration: 45, icon: '🫧', image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=800&q=80', description: 'Complete diagnosis of spin error, noise, water leakage and drain issues.' },
          { name: 'Front Load Drum Bearing Fix', basePrice: 1299, duration: 90, icon: '⚙️', image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80', description: 'Heavyduty bearing & spider arm replacement to eliminate grinding noise.' }
        ]
      },
      {
        name: 'Top Load & Semi-Auto Repair',
        icon: '🧺',
        description: 'Gearbox fix, wash motor replacement & agitator repair',
        services: [
          { name: 'Top Load Washing Machine Service', basePrice: 349, duration: 45, icon: '🧼', image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80', description: 'Inlet valve check, wash pulsator cleaning & spin tub alignment.' },
          { name: 'Semi-Automatic Motor Replacement', basePrice: 799, duration: 60, icon: '⚡', image: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=800&q=80', description: 'Spin motor / wash motor replacement with genuine spare parts.' }
        ]
      }
    ]
  },

  // 3. Refrigerator Repair
  {
    name: 'Refrigerator Repair',
    slug: 'refrigerator-repair',
    icon: '🧊',
    color: '#0ea5e9',
    image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Single door, double door & inverter fridge cooling repair, gas refill & thermostat',
    sortOrder: 3,
    serviceTypes: [
      {
        name: 'Single & Double Door Repair',
        icon: '🚪',
        description: 'Cooling diagnosis, defrost timer, relay & door gasket repair',
        services: [
          { name: 'Double Door Fridge Cooling Fix', basePrice: 449, duration: 45, icon: '🧊', image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=800&q=80', description: 'Fan motor, bimetal sensor and defrost heater testing & repair.' },
          { name: 'Single Door Fridge Repair', basePrice: 349, duration: 45, icon: '❄️', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80', description: 'Thermostat replacement, relay capacitor check and ice formation fix.' }
        ]
      },
      {
        name: 'Fridge Gas Refill & Compressor',
        icon: '⚡',
        description: 'Eco refrigerant charging R600a/R134a and compressor replacement',
        services: [
          { name: 'Refrigerator Gas Refill (R600a/R134a)', basePrice: 1899, duration: 60, icon: '💨', image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=800&q=80', description: 'Copper filter dryer replacement, vacuum evacuating and eco gas charging.' }
        ]
      }
    ]
  },

  // 4. RO & Water Purifier
  {
    name: 'RO & Water Purifier',
    slug: 'ro-water-purifier',
    icon: '💧',
    color: '#06b6d4',
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'RO membrane change, filter replacement, TDS calibration & leak repair',
    sortOrder: 4,
    serviceTypes: [
      {
        name: 'RO Filter Change & Service',
        icon: '🧪',
        description: 'Complete filter replacement including sediment, carbon & RO membrane',
        services: [
          { name: 'RO Full Filter Kit Replacement', basePrice: 1499, duration: 45, icon: '💧', image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=800&q=80', description: 'Pre-filter, sediment filter, carbon block & 75 GPD RO membrane change.' },
          { name: 'RO Basic Service & Sanitize', basePrice: 349, duration: 30, icon: '🧼', image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=800&q=80', description: 'Tank descaling, UV choke test, TDS check and pipe leak fix.' }
        ]
      }
    ]
  },

  // 5. Geyser Repair
  {
    name: 'Geyser Repair',
    slug: 'geyser-repair',
    icon: '🔥',
    color: '#ef4444',
    image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Electric & gas geyser installation, element & thermostat repair',
    sortOrder: 5,
    serviceTypes: [
      {
        name: 'Electric & Gas Geyser Repair',
        icon: '🔥',
        description: 'Coil element replacement, thermostat cutout & safety valve fix',
        services: [
          { name: 'Geyser Heating Element Change', basePrice: 599, duration: 45, icon: '⚡', image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80', description: 'Heavy-duty 2kW/3kW copper element replacement with fresh gasket seal.' },
          { name: 'Geyser Installation Service', basePrice: 449, duration: 45, icon: '🛠️', image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80', description: 'Wall bracket drilling, inlet/outlet hose connection and safety test.' }
        ]
      }
    ]
  },

  // 6. Air Cooler Repair
  {
    name: 'Air Cooler Repair',
    slug: 'air-cooler-repair',
    icon: '🌬️',
    color: '#38bdf8',
    image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Desert & personal air cooler motor repair, honeycomb pad change & cleaning',
    sortOrder: 6,
    serviceTypes: [
      {
        name: 'Cooler Servicing & Repairs',
        icon: '🌬️',
        description: 'Water pump replacement, fan motor rewinding & pad change',
        services: [
          { name: 'Air Cooler Full Service & Pad Change', basePrice: 399, duration: 45, icon: '🌬️', image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80', description: 'Honeycomb pad replacement, water pump cleaning and fan motor oiling.' },
          { name: 'Cooler Water Pump Replacement', basePrice: 299, duration: 30, icon: '🚰', image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80', description: 'Submersible water pump fitting and water distribution pipe cleaning.' }
        ]
      }
    ]
  },

  // 7. Microwave Repair
  {
    name: 'Microwave Repair',
    slug: 'microwave-repair',
    icon: '📻',
    color: '#f59e0b',
    image: 'https://images.unsplash.com/photo-1574269909862-7e4d70584de4?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Solo, grill & convection microwave magnetron, high voltage diode & touch panel repair',
    sortOrder: 7,
    serviceTypes: [
      {
        name: 'Microwave Heating & PCB Fix',
        icon: '📻',
        description: 'Magnetron replacement, door switch fix and touch panel repair',
        services: [
          { name: 'Microwave Not Heating Repair', basePrice: 449, duration: 40, icon: '🔥', image: 'https://images.unsplash.com/photo-1574269909862-7e4d70584de4?auto=format&fit=crop&w=800&q=80', description: 'Magnetron testing, high voltage diode replacement and transformer check.' },
          { name: 'Touchpad / Control Board Repair', basePrice: 699, duration: 45, icon: '🔌', image: 'https://images.unsplash.com/photo-1597733336794-12d05021d510?auto=format&fit=crop&w=800&q=80', description: 'Membrane key panel fix and micro-controller board soldering.' }
        ]
      }
    ]
  },

  // 8. Television Repair
  {
    name: 'Television Repair',
    slug: 'television-repair',
    icon: '📺',
    color: '#6366f1',
    image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'LED/OLED TV backlight strip change, motherboard repair & wall mounting',
    sortOrder: 8,
    serviceTypes: [
      {
        name: 'LED & Smart TV Repairs',
        icon: '📺',
        description: 'Screen backlight replacement, power board fix & sound issues',
        services: [
          { name: 'LED TV Backlight Strip Replacement', basePrice: 1299, duration: 60, icon: '💡', image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=800&q=80', description: 'Full backlight strip set replacement for uniform screen brightness.' },
          { name: 'TV Wall Mount Installation', basePrice: 299, duration: 30, icon: '🖼️', image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=800&q=80', description: 'Heavy duty swivel/fixed TV wall bracket fitting & cable arrangement.' }
        ]
      }
    ]
  },

  // 9. Chimney Repair & Cleaning
  {
    name: 'Chimney Repair & Cleaning',
    slug: 'chimney-repair-cleaning',
    icon: '🍳',
    color: '#14b8a6',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Kitchen chimney deep degreasing, motor repair & duct pipe fitting',
    sortOrder: 9,
    serviceTypes: [
      {
        name: 'Chimney Cleaning & Servicing',
        icon: '🍳',
        description: 'Auto-clean chimney degreasing, baffle filter wash & motor check',
        services: [
          { name: 'Kitchen Chimney Deep Cleaning', basePrice: 799, duration: 60, icon: '🧽', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80', description: 'Heavy grease remover chemical foam wash for filters, blower fan and housing.' }
        ]
      }
    ]
  },

  // 10. Dishwasher Repair
  {
    name: 'Dishwasher Repair',
    slug: 'dishwasher-repair',
    icon: '🍽️',
    color: '#8b5cf6',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Built-in & standalone dishwasher repair, drain pump fix & spray arm unclogging',
    sortOrder: 10,
    serviceTypes: [
      {
        name: 'Dishwasher Repairs',
        icon: '🍽️',
        description: 'Drainage pump fix, heating element check & water inlet valve replacement',
        services: [
          { name: 'Dishwasher General Service & Unclog', basePrice: 499, duration: 45, icon: '🍽️', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80', description: 'Spray arm nozzle cleaning, filter wash and drainage line inspection.' }
        ]
      }
    ]
  },

  // 11. Electrician Services
  {
    name: 'Electrician Services',
    slug: 'electrician-services',
    icon: '⚡',
    color: '#d97706',
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Wiring, MCB fitting, switchboard repair, ceiling fan & chandelier light fitting',
    sortOrder: 11,
    serviceTypes: [
      {
        name: 'Switches & Wiring',
        icon: '🔌',
        description: 'Modular socket replacement, short circuit diagnosis & DB box wiring',
        services: [
          { name: 'Switchboard Repair & Fitting', basePrice: 199, duration: 30, icon: '🔌', image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80', description: 'Modular switch replacement, wire connection repair and earthing check.' },
          { name: 'Short Circuit & MCB Trip Repair', basePrice: 399, duration: 45, icon: '⚡', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80', description: 'Main distribution box fault finding, neutral wire check and MCB change.' }
        ]
      },
      {
        name: 'Fan & Light Fitting',
        icon: '💡',
        description: 'Ceiling fan, exhaust fan, LED tubelight & fancy lamp installation',
        services: [
          { name: 'Ceiling Fan Installation & Repair', basePrice: 249, duration: 30, icon: '🌀', image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80', description: 'Fan hook mounting, regulator wiring & capacitor replacement.' },
          { name: 'Chandelier / Fancy Light Hanging', basePrice: 499, duration: 45, icon: '💡', image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80', description: 'Heavy light fixture ceiling anchoring and transformer wiring.' }
        ]
      }
    ]
  },

  // 12. Plumbing Services
  {
    name: 'Plumbing Services',
    slug: 'plumbing-services',
    icon: '🔧',
    color: '#475569',
    image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Tap leak repair, pipeline unclogging, cistern fix & water tank cleaning',
    sortOrder: 12,
    serviceTypes: [
      {
        name: 'Tap & Shower Repairs',
        icon: '🚰',
        description: 'Mixer tap fixing, shower head mounting, health faucet gun change',
        services: [
          { name: 'Tap & Mixer Leak Repair', basePrice: 199, duration: 30, icon: '🚰', image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80', description: 'Washer seal replacement, spindle repair & wall mixer installation.' },
          { name: 'Toilet Flush Cistern Repair', basePrice: 299, duration: 45, icon: '🚽', image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80', description: 'Dual flush valve kit replacement, siphon change and inlet float valve fix.' }
        ]
      },
      {
        name: 'Drainage & Pipe Unclogging',
        icon: '🛠️',
        description: 'Sink, wash basin & bathroom drain blockage removal',
        services: [
          { name: 'Blocked Drain Line Unclogging', basePrice: 499, duration: 45, icon: '🌊', image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80', description: 'Pressure drain cleaning wire & eco-chemical blockage removal.' }
        ]
      }
    ]
  },

  // 13. Carpentry Services
  {
    name: 'Carpentry Services',
    slug: 'carpentry-services',
    icon: '🪚',
    color: '#ea580c',
    image: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Furniture assembly, door lock repair, cabinet & woodwork repair',
    sortOrder: 13,
    serviceTypes: [
      {
        name: 'Door & Lock Repairs',
        icon: '🚪',
        description: 'Door hinge replacement, mortise lock fitting & latch repair',
        services: [
          { name: 'Door Lock Repair & Fitting', basePrice: 299, duration: 30, icon: '🔒', image: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=800&q=80', description: 'Main door lock replacement, handle fitting and latch alignment.' },
          { name: 'Wooden Furniture Assembly', basePrice: 599, duration: 60, icon: '🗄️', image: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=800&q=80', description: 'Flatpack wardrobe, bed or table assembly using power tools.' }
        ]
      }
    ]
  },

  // 14. House Painting
  {
    name: 'House Painting',
    slug: 'house-painting',
    icon: '🎨',
    color: '#db2777',
    image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Interior & exterior wall painting, waterproofing & stencil designs',
    sortOrder: 14,
    serviceTypes: [
      {
        name: 'Interior Wall Painting',
        icon: '🎨',
        description: 'Royale emulsion, tractor acrylic, wall putty & sanding',
        services: [
          { name: 'Single Room Wall Painting', basePrice: 1999, duration: 180, icon: '🎨', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=800&q=80', description: 'Two coats of premium emulsion paint with floor protection sheets.' },
          { name: 'Wall Dampness Waterproofing', basePrice: 1499, duration: 120, icon: '💧', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=800&q=80', description: 'Dampproof chemical primer coating to prevent paint peeling & dampness.' }
        ]
      }
    ]
  },

  // 15. Full Home Deep Cleaning
  {
    name: 'Full Home Deep Cleaning',
    slug: 'full-home-deep-cleaning',
    icon: '🧹',
    color: '#059669',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Full apartment & villa deep cleaning with heavy scrubber machine',
    sortOrder: 15,
    serviceTypes: [
      {
        name: 'Apartment Deep Cleaning',
        icon: '🧹',
        description: 'Kitchen, bathroom, balcony, window glass & floor scrubbing',
        services: [
          { name: '1 BHK Full Home Deep Cleaning', basePrice: 2499, duration: 180, icon: '🏠', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80', description: 'Complete deep cleaning of 1 BHK including kitchen cabinets, bathroom scrubbing & windows.' },
          { name: '2 BHK Full Home Deep Cleaning', basePrice: 3499, duration: 240, icon: '🏡', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80', description: 'Deep sanitization and floor machine buffing for 2 BHK apartment.' },
          { name: '3 BHK Full Home Deep Cleaning', basePrice: 4499, duration: 300, icon: '🏢', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80', description: 'Heavy-duty 4-member crew deep cleaning for 3 BHK residence.' }
        ]
      }
    ]
  },

  // 16. Sofa & Upholstery Cleaning
  {
    name: 'Sofa & Upholstery Cleaning',
    slug: 'sofa-upholstery-cleaning',
    icon: '🛋️',
    color: '#a855f7',
    image: 'https://images.unsplash.com/photo-1603712725038-e9334ae8f39f?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Fabric & leather sofa vacuum injection-extraction shampoo cleaning',
    sortOrder: 16,
    serviceTypes: [
      {
        name: 'Sofa & Mattress Shampoo',
        icon: '🛋️',
        description: 'Stain extraction shampoo & vacuum drying for sofas & mattresses',
        services: [
          { name: '5-Seater Sofa Shampoo Deep Clean', basePrice: 999, duration: 60, icon: '🛋️', image: 'https://images.unsplash.com/photo-1603712725038-e9334ae8f39f?auto=format&fit=crop&w=800&q=80', description: 'Foam injection and high-suction vacuum extraction removing deep dirt and odors.' },
          { name: 'King Size Mattress Deep Sanitization', basePrice: 899, duration: 45, icon: '🛏️', image: 'https://images.unsplash.com/photo-1603712725038-e9334ae8f39f?auto=format&fit=crop&w=800&q=80', description: 'UV-C sterilization and hot water extraction for allergen-free sleep.' }
        ]
      }
    ]
  },

  // 17. Bathroom Cleaning
  {
    name: 'Bathroom Cleaning',
    slug: 'bathroom-cleaning',
    icon: '🧼',
    color: '#0284c7',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Hard water scale removal, tile scrubbing, tap shine & toilet sanitization',
    sortOrder: 17,
    serviceTypes: [
      {
        name: 'Bathroom Tile & Tap Clean',
        icon: '🧼',
        description: 'Acid-free tile stain remover chemical wash & chrome tap polish',
        services: [
          { name: 'Single Bathroom Deep Cleaning', basePrice: 499, duration: 45, icon: '🚿', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80', description: 'Removal of yellow hard water stains from tiles, glass partitions and taps.' }
        ]
      }
    ]
  },

  // 18. Pest Control Services
  {
    name: 'Pest Control Services',
    slug: 'pest-control-services',
    icon: '🐛',
    color: '#65a30d',
    image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Cockroach herbal gel, termite anti-borer treatment & bed bug spray',
    sortOrder: 18,
    serviceTypes: [
      {
        name: 'Cockroach & General Pest',
        icon: '🪳',
        description: 'Odorless Bayer gel application for 100% cockroach elimination',
        services: [
          { name: 'Cockroach & Ant Control (2 Visits)', basePrice: 899, duration: 45, icon: '🪳', image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80', description: 'Odorless gel dotting in kitchen cabinets + synthetic spray along borders.' },
          { name: 'Termite Drill & Fill Treatment', basePrice: 2499, duration: 120, icon: '🐛', image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80', description: 'Chemical injection into wall-floor joints with 1-year warranty.' }
        ]
      }
    ]
  },

  // 19. Salon for Women
  {
    name: 'Salon for Women',
    slug: 'salon-for-women',
    icon: '💇‍♀️',
    color: '#ec4899',
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Doorstep beauty services: facial, waxing, manicure, pedicure & hair styling',
    sortOrder: 19,
    serviceTypes: [
      {
        name: 'Facial & Waxing Packages',
        icon: '✨',
        description: 'Organic fruit facial, Rica honey waxing & de-tan glow treatments',
        services: [
          { name: 'Glowing Fruit Facial & De-Tan Pack', basePrice: 899, duration: 60, icon: '✨', image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80', description: 'Deep pore massage, cleansing steam & anti-tan pack application.' },
          { name: 'Full Legs & Arms Rica Waxing', basePrice: 799, duration: 45, icon: '🍯', image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80', description: 'Painless lipo-soluble Rica white chocolate wax with post-wax soothing oil.' }
        ]
      }
    ]
  },

  // 20. Salon for Men
  {
    name: 'Salon for Men',
    slug: 'salon-for-men',
    icon: '💇‍♂️',
    color: '#0284c7',
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Men haircut, beard styling, charcoal face cleanup & hair color at home',
    sortOrder: 20,
    serviceTypes: [
      {
        name: 'Grooming & Haircut',
        icon: '✂️',
        description: 'Professional barber haircut, razor beard shaping & charcoal cleanup',
        services: [
          { name: 'Men Haircut & Beard Trim Combo', basePrice: 349, duration: 45, icon: '✂️', image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80', description: 'Hygienic single-use cape haircut, hot towel beard styling and head massage.' }
        ]
      }
    ]
  },

  // 21. Spa & Massage
  {
    name: 'Spa & Massage',
    slug: 'spa-massage',
    icon: '🧘',
    color: '#14b8a6',
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Swedish deep tissue body massage, head massage & foot reflexology',
    sortOrder: 21,
    serviceTypes: [
      {
        name: 'Body Therapies',
        icon: '💆',
        description: 'Certified massage therapist with portable bed & aromatic oils',
        services: [
          { name: 'Swedish Deep Tissue Body Massage (60 min)', basePrice: 1499, duration: 60, icon: '🧘', image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80', description: 'Full body muscle tension release massage using warm herbal oils.' }
        ]
      }
    ]
  }
];

async function seedCatalog() {
  logger.info('🚀 Starting Safe OneWayFix Service Catalog Cleanup & Seeder (21 Canonical Categories)...');

  const { Booking } = require('../models');

  const canonicalSlugs = FULL_CATALOG.map(c => c.slug);
  const canonicalNames = FULL_CATALOG.map(c => c.name);

  // 1. CLEANUP / MIGRATION OF OBSOLETE & DUPLICATE CATEGORIES & SERVICES
  const existingCategories = await Category.find({});
  for (const oldCat of existingCategories) {
    if (!canonicalSlugs.includes(oldCat.slug) && !canonicalNames.includes(oldCat.name)) {
      const oldServices = await Service.find({
        $or: [{ categoryId: oldCat._id }, { category: oldCat.name }]
      });

      for (const oldService of oldServices) {
        const isReferencedInBooking = await Booking.exists({ serviceId: oldService._id });
        if (isReferencedInBooking) {
          oldService.isActive = false;
          oldService.isArchived = true;
          await oldService.save();
          logger.info(` ⚠️ Archived legacy service referenced in booking: ${oldService.name} (${oldService._id})`);
        } else {
          await Service.deleteOne({ _id: oldService._id });
          logger.info(` 🗑️ Removed obsolete service: ${oldService.name}`);
        }
      }

      const oldTypes = await ServiceType.find({
        $or: [{ categoryId: oldCat._id }, { categorySlug: oldCat.slug }]
      });
      for (const oldType of oldTypes) {
        const remainingServicesCount = await Service.countDocuments({ serviceTypeId: oldType._id });
        if (remainingServicesCount > 0) {
          oldType.status = 'inactive';
          oldType.isArchived = true;
          await oldType.save();
        } else {
          await ServiceType.deleteOne({ _id: oldType._id });
        }
      }

      const remainingCatServicesCount = await Service.countDocuments({
        $or: [{ categoryId: oldCat._id }, { category: oldCat.name }]
      });
      if (remainingCatServicesCount > 0) {
        oldCat.status = 'inactive';
        oldCat.isArchived = true;
        await oldCat.save();
        logger.info(` ⚠️ Deactivated legacy category with bookings: ${oldCat.name}`);
      } else {
        await Category.deleteOne({ _id: oldCat._id });
        logger.info(` 🗑️ Removed obsolete category: ${oldCat.name}`);
      }
    }
  }

  // Cleanup orphan obsolete services not matching canonical names
  const allObsoleteServices = await Service.find({
    category: { $nin: canonicalNames }
  });
  for (const orphanService of allObsoleteServices) {
    const isReferenced = await Booking.exists({ serviceId: orphanService._id });
    if (isReferenced) {
      orphanService.isActive = false;
      await orphanService.save();
    } else {
      await Service.deleteOne({ _id: orphanService._id });
    }
  }

  // 2. UPSERT CANONICAL 21 CATEGORIES, SERVICE TYPES & SERVICES
  let totalCategoriesUpserted = 0;
  let totalServiceTypesUpserted = 0;
  let totalServicesUpserted = 0;

  for (const catData of FULL_CATALOG) {
    let category = await Category.findOne({
      $or: [{ slug: catData.slug }, { name: catData.name }]
    });

    if (!category) {
      category = await Category.create({
        name: catData.name,
        slug: catData.slug,
        icon: catData.icon,
        color: catData.color,
        image: catData.image,
        shortDescription: catData.shortDescription,
        sortOrder: catData.sortOrder,
        status: 'active',
        isArchived: false,
      });
    } else {
      category.name = catData.name;
      category.slug = catData.slug;
      category.icon = catData.icon;
      category.color = catData.color;
      category.image = catData.image;
      category.shortDescription = catData.shortDescription;
      category.sortOrder = catData.sortOrder;
      category.status = 'active';
      category.isArchived = false;
      await category.save();
    }
    totalCategoriesUpserted++;

    for (let i = 0; i < catData.serviceTypes.length; i++) {
      const stData = catData.serviceTypes[i];
      const stBaseSlug = stData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const stSlug = `${category.slug}-${stBaseSlug}`;

      let serviceType = await ServiceType.findOne({
        categoryId: category._id,
        $or: [{ slug: stSlug }, { name: stData.name }]
      });

      if (!serviceType) {
        serviceType = await ServiceType.create({
          categoryId: category._id,
          categorySlug: category.slug,
          name: stData.name,
          slug: stSlug,
          icon: stData.icon || category.icon,
          description: stData.description || '',
          sortOrder: i + 1,
          status: 'active',
          isArchived: false,
        });
      } else {
        serviceType.categoryId = category._id;
        serviceType.categorySlug = category.slug;
        serviceType.name = stData.name;
        serviceType.slug = stSlug;
        serviceType.icon = stData.icon || category.icon;
        serviceType.description = stData.description || serviceType.description;
        serviceType.status = 'active';
        serviceType.isArchived = false;
        await serviceType.save();
      }
      totalServiceTypesUpserted++;

      if (stData.services && stData.services.length > 0) {
        for (let j = 0; j < stData.services.length; j++) {
          const sData = stData.services[j];
          const sBaseSlug = sData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

          let service = await Service.findOne({
            $or: [
              { slug: sBaseSlug },
              { name: sData.name, category: category.name }
            ]
          });

          const servicePayload = {
            name: sData.name,
            slug: sBaseSlug,
            category: category.name,
            subcategory: serviceType.name,
            categoryId: category._id,
            serviceTypeId: serviceType._id,
            description: sData.description,
            basePrice: sData.basePrice,
            duration: sData.duration || 60,
            icon: sData.icon || serviceType.icon,
            image: sData.image || category.image,
            imageUrl: sData.image || category.image,
            imageAlt: `${sData.name} service photo`,
            imageSource: 'preset',
            gstPct: 18,
            isEmergencyAvailable: j === 0,
            emergencyCharge: j === 0 ? 299 : 0,
            visitCharge: 99,
            locationAvailability: 'all',
            allowedCities: ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune'],
            warrantyDays: 30,
            plusDiscountPct: 10,
            isActive: true,
            sortOrder: j + 1,
            popularityScore: 85 - j * 5,
            includes: [
              'Background verified technician',
              'Single-use sanitized tool kit',
              '30-Day Service Guarantee',
              'Post-service testing & cleaning'
            ],
            excludes: [
              'Spare parts cost (billed separately if required)',
              'Major masonry / civil work'
            ]
          };

          if (!service) {
            await Service.create(servicePayload);
          } else {
            Object.assign(service, servicePayload);
            await service.save();
          }
          totalServicesUpserted++;
        }
      }
    }

    const activeServiceCount = await Service.countDocuments({
      categoryId: category._id,
      isActive: true
    });
    category.serviceCount = activeServiceCount;
    await category.save();
  }

  // 3. VALIDATION SUMMARY
  const activeCategories = await Category.find({ status: 'active', isArchived: { $ne: true } }).sort({ sortOrder: 1 });
  const activeServiceTypes = await ServiceType.find({ status: 'active', isArchived: { $ne: true } });
  const activeServices = await Service.find({ isActive: true });

  const catSlugs = activeCategories.map(c => c.slug);
  const duplicateCategoriesCount = catSlugs.length - new Set(catSlugs).size;

  const stSlugs = activeServiceTypes.map(st => st.slug);
  const duplicateServiceTypesCount = stSlugs.length - new Set(stSlugs).size;

  const sSlugs = activeServices.map(s => s.slug);
  const duplicateServicesCount = sSlugs.length - new Set(sSlugs).size;

  console.log('\n========================================');
  console.log('ONEWAYFIX CATALOG VALIDATION');
  console.log('========================================');
  console.log(`Categories: ${activeCategories.length}`);
  console.log(`Service Types: ${activeServiceTypes.length}`);
  console.log(`Bookable Services: ${activeServices.length}\n`);
  console.log('Active Categories:');
  activeCategories.forEach((c, idx) => {
    console.log(`${idx + 1}. ${c.name}`);
  });
  console.log(`\nDuplicate Categories: ${duplicateCategoriesCount}`);
  console.log(`Duplicate Service Types: ${duplicateServiceTypesCount}`);
  console.log(`Duplicate Services: ${duplicateServicesCount}`);
  console.log('========================================');

  if (activeCategories.length !== 21) {
    console.error(`❌ CATALOG SEED FAILURE: Expected 21 active categories, found ${activeCategories.length}`);
    throw new Error(`Catalog validation failed: active categories count is ${activeCategories.length}`);
  }

  console.log('CATALOG SEED SUCCESS');
  console.log('========================================\n');
}

module.exports = { seedCatalog };

if (require.main === module) {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/servicehub';
  mongoose.connect(MONGO_URI)
    .then(async () => {
      await seedCatalog();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
