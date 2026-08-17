'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const { GeoHierarchy, OperationalRegion } = require('../models');
const logger = require('../utils/logger');

const INDIA_STATES_DATA = [
  {
    stateCode: 'TG', stateName: 'Telangana', type: 'state',
    districts: [
      { code: 'TG-HYD', name: 'Hyderabad', cities: ['Hyderabad', 'Secunderabad', 'Madhapur', 'Gachibowli', 'Kukatpally', 'Hitech City', 'Kondapur', 'Banjara Hills', 'Jubilee Hills'] },
      { code: 'TG-RNG', name: 'Ranga Reddy', cities: ['Cyberabad', 'Manikonda', 'Financial District', 'Shamshabad', 'Rajendranagar'] },
      { code: 'TG-MED', name: 'Medchal-Malkajgiri', cities: ['Malkajgiri', 'Uppal', 'Kompally', 'Alwal'] },
      { code: 'TG-WGL', name: 'Warangal', cities: ['Warangal', 'Hanamkonda', 'Kazipet'] },
      { code: 'TG-KMN', name: 'Karimnagar', cities: ['Karimnagar'] },
      { code: 'TG-NZB', name: 'Nizamabad', cities: ['Nizamabad'] },
    ],
  },
  {
    stateCode: 'KA', stateName: 'Karnataka', type: 'state',
    districts: [
      { code: 'KA-BLR', name: 'Bengaluru Urban', cities: ['Bengaluru', 'Indiranagar', 'Koramangala', 'Whitefield', 'Electronic City', 'HSR Layout', 'Marathahalli', 'Jayanagar', 'Yelahanka'] },
      { code: 'KA-MYS', name: 'Mysuru', cities: ['Mysuru'] },
      { code: 'KA-MNG', name: 'Dakshina Kannada', cities: ['Mangaluru'] },
      { code: 'KA-HUB', name: 'Dharwad', cities: ['Hubballi', 'Dharwad'] },
      { code: 'KA-BEL', name: 'Belagavi', cities: ['Belagavi'] },
    ],
  },
  {
    stateCode: 'MH', stateName: 'Maharashtra', type: 'state',
    districts: [
      { code: 'MH-MUM', name: 'Mumbai City', cities: ['Mumbai', 'Colaba', 'Bandra', 'Andheri', 'Juhu', 'Dadar', 'Worli'] },
      { code: 'MH-SUB', name: 'Mumbai Suburban', cities: ['Borivali', 'Malad', 'Powai', 'Ghatkopar', 'Mulund'] },
      { code: 'MH-TNE', name: 'Thane', cities: ['Thane', 'Navi Mumbai', 'Kalyan', 'Dombivli'] },
      { code: 'MH-PUN', name: 'Pune', cities: ['Pune', 'Pimpri-Chinchwad', 'Hinjawadi', 'Viman Nagar', 'Kothrud', 'Baner'] },
      { code: 'MH-NAG', name: 'Nagpur', cities: ['Nagpur'] },
      { code: 'MH-NSK', name: 'Nashik', cities: ['Nashik'] },
    ],
  },
  {
    stateCode: 'DL', stateName: 'Delhi', type: 'ut',
    districts: [
      { code: 'DL-CND', name: 'Central Delhi', cities: ['Connaught Place', 'Karol Bagh'] },
      { code: 'DL-SDH', name: 'South Delhi', cities: ['Saket', 'Hauz Khas', 'Vasant Kunj', 'Greater Kailash'] },
      { code: 'DL-SWD', name: 'South West Delhi', cities: ['Dwarka'] },
      { code: 'DL-WST', name: 'West Delhi', cities: ['Janakpuri', 'Rajouri Garden'] },
    ],
  },
  {
    stateCode: 'HR', stateName: 'Haryana', type: 'state',
    districts: [
      { code: 'HR-GGM', name: 'Gurugram', cities: ['Gurugram', 'DLF Phase 1-5', 'Sohna Road', 'Golf Course Road'] },
      { code: 'HR-FDB', name: 'Faridabad', cities: ['Faridabad'] },
      { code: 'HR-PKL', name: 'Panchkula', cities: ['Panchkula'] },
    ],
  },
  {
    stateCode: 'UP', stateName: 'Uttar Pradesh', type: 'state',
    districts: [
      { code: 'UP-GZB', name: 'Gautam Buddha Nagar', cities: ['Noida', 'Greater Noida'] },
      { code: 'UP-GHZ', name: 'Ghaziabad', cities: ['Ghaziabad', 'Indirapuram', 'Vaishali'] },
      { code: 'UP-LKO', name: 'Lucknow', cities: ['Lucknow', 'Gomti Nagar', 'Hazratganj'] },
      { code: 'UP-KNP', name: 'Kanpur Nagar', cities: ['Kanpur'] },
      { code: 'UP-VAR', name: 'Varanasi', cities: ['Varanasi'] },
      { code: 'UP-AGR', name: 'Agra', cities: ['Agra'] },
    ],
  },
  {
    stateCode: 'TN', stateName: 'Tamil Nadu', type: 'state',
    districts: [
      { code: 'TN-CHN', name: 'Chennai', cities: ['Chennai', 'T. Nagar', 'Velachery', 'Anna Nagar', 'OMR', 'Adyar', 'Mylapore'] },
      { code: 'TN-CBE', name: 'Coimbatore', cities: ['Coimbatore'] },
      { code: 'TN-MDU', name: 'Madurai', cities: ['Madurai'] },
    ],
  },
  {
    stateCode: 'WB', stateName: 'West Bengal', type: 'state',
    districts: [
      { code: 'WB-KOL', name: 'Kolkata', cities: ['Kolkata', 'Salt Lake', 'New Town', 'Park Street', 'Alipore'] },
      { code: 'WB-HWR', name: 'Howrah', cities: ['Howrah'] },
    ],
  },
  {
    stateCode: 'GJ', stateName: 'Gujarat', type: 'state',
    districts: [
      { code: 'GJ-AMD', name: 'Ahmedabad', cities: ['Ahmedabad', 'Gandhinagar', 'SG Highway', 'Bodakdev'] },
      { code: 'GJ-SRT', name: 'Surat', cities: ['Surat'] },
      { code: 'GJ-VDR', name: 'Vadodara', cities: ['Vadodara'] },
    ],
  },
  {
    stateCode: 'AP', stateName: 'Andhra Pradesh', type: 'state',
    districts: [
      { code: 'AP-VZG', name: 'Visakhapatnam', cities: ['Visakhapatnam', 'Gajuwaka'] },
      { code: 'AP-VJW', name: 'NTR (Vijayawada)', cities: ['Vijayawada'] },
      { code: 'AP-GNT', name: 'Guntur', cities: ['Guntur'] },
      { code: 'AP-TPT', name: 'Tirupati', cities: ['Tirupati'] },
    ],
  },
  {
    stateCode: 'RJ', stateName: 'Rajasthan', type: 'state',
    districts: [
      { code: 'RJ-JPR', name: 'Jaipur', cities: ['Jaipur', 'Malviya Nagar', 'Vaishali Nagar'] },
      { code: 'RJ-JOD', name: 'Jodhpur', cities: ['Jodhpur'] },
      { code: 'RJ-UDP', name: 'Udaipur', cities: ['Udaipur'] },
    ],
  },
  {
    stateCode: 'PB', stateName: 'Punjab', type: 'state',
    districts: [
      { code: 'PB-SAS', name: 'SAS Nagar (Mohali)', cities: ['Mohali'] },
      { code: 'PB-LDH', name: 'Ludhiana', cities: ['Ludhiana'] },
      { code: 'PB-ASR', name: 'Amritsar', cities: ['Amritsar'] },
    ],
  },
  {
    stateCode: 'CH', stateName: 'Chandigarh', type: 'ut',
    districts: [
      { code: 'CH-CHD', name: 'Chandigarh', cities: ['Chandigarh'] },
    ],
  },
  {
    stateCode: 'KL', stateName: 'Kerala', type: 'state',
    districts: [
      { code: 'KL-EKM', name: 'Ernakulam', cities: ['Kochi', 'Kakkanad'] },
      { code: 'KL-TVM', name: 'Thiruvananthapuram', cities: ['Thiruvananthapuram', 'Technopark'] },
    ],
  },
  {
    stateCode: 'MP', stateName: 'Madhya Pradesh', type: 'state',
    districts: [
      { code: 'MP-IND', name: 'Indore', cities: ['Indore', 'Vijay Nagar'] },
      { code: 'MP-BPL', name: 'Bhopal', cities: ['Bhopal'] },
    ],
  },
  {
    stateCode: 'BR', stateName: 'Bihar', type: 'state',
    districts: [
      { code: 'BR-PAT', name: 'Patna', cities: ['Patna'] },
    ],
  },
  {
    stateCode: 'OD', stateName: 'Odisha', type: 'state',
    districts: [
      { code: 'OD-KHD', name: 'Khurda', cities: ['Bhubaneswar'] },
      { code: 'OD-CTC', name: 'Cuttack', cities: ['Cuttack'] },
    ],
  },
];

async function seedGeoData() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/servicehub';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB for geo seeding...');

    // 1. Seed GeoHierarchy
    for (const stateData of INDIA_STATES_DATA) {
      await GeoHierarchy.updateOne(
        { stateCode: stateData.stateCode },
        {
          stateCode: stateData.stateCode,
          stateName: stateData.stateName,
          type: stateData.type,
          districts: stateData.districts,
          isActive: true,
        },
        { upsert: true }
      );
    }
    logger.info(`✅ Seeded ${INDIA_STATES_DATA.length} Indian States & Union Territories into GeoHierarchy.`);

    // 2. Seed Default Operational Regions
    const DEFAULT_REGIONS = [
      { name: 'Hyderabad Central (Hitech City - Jubilee Hills)', code: 'REG-TG-HYD-01', stateCode: 'TG', stateName: 'Telangana', districtCode: 'TG-HYD', districtName: 'Hyderabad', cityName: 'Hyderabad', status: 'active', coverageLevel: 'full_coverage', targetProviders: 50, serviceCategories: ['AC Repair', 'Cleaning', 'Plumbing', 'Electrical'] },
      { name: 'Hyderabad East (Uppal - Malkajgiri)', code: 'REG-TG-HYD-02', stateCode: 'TG', stateName: 'Telangana', districtCode: 'TG-MED', districtName: 'Medchal-Malkajgiri', cityName: 'Secunderabad', status: 'active', coverageLevel: 'high_demand', targetProviders: 30, serviceCategories: ['AC Repair', 'Cleaning'] },
      { name: 'Bengaluru Central & East (Indiranagar - Whitefield)', code: 'REG-KA-BLR-01', stateCode: 'KA', stateName: 'Karnataka', districtCode: 'KA-BLR', districtName: 'Bengaluru Urban', cityName: 'Bengaluru', status: 'active', coverageLevel: 'full_coverage', targetProviders: 75, serviceCategories: ['AC Repair', 'Cleaning', 'Plumbing', 'Appliance Repair'] },
      { name: 'Bengaluru South (Koramangala - HSR Layout)', code: 'REG-KA-BLR-02', stateCode: 'KA', stateName: 'Karnataka', districtCode: 'KA-BLR', districtName: 'Bengaluru Urban', cityName: 'Bengaluru', status: 'active', coverageLevel: 'full_coverage', targetProviders: 60, serviceCategories: ['AC Repair', 'Cleaning', 'Electrical'] },
      { name: 'Mumbai Western Suburbs (Andheri - Juhu)', code: 'REG-MH-MUM-01', stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'MH-SUB', districtName: 'Mumbai Suburban', cityName: 'Mumbai', status: 'active', coverageLevel: 'full_coverage', targetProviders: 80, serviceCategories: ['AC Repair', 'Cleaning', 'Plumbing', 'Painting'] },
      { name: 'Pune IT Corridor (Hinjawadi - Baner)', code: 'REG-MH-PUN-01', stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'MH-PUN', districtName: 'Pune', cityName: 'Pune', status: 'active', coverageLevel: 'high_demand', targetProviders: 40, serviceCategories: ['AC Repair', 'Cleaning'] },
      { name: 'Delhi NCR Gurugram (DLF - Golf Course Road)', code: 'REG-HR-GGM-01', stateCode: 'HR', stateName: 'Haryana', districtCode: 'HR-GGM', districtName: 'Gurugram', cityName: 'Gurugram', status: 'active', coverageLevel: 'full_coverage', targetProviders: 50, serviceCategories: ['AC Repair', 'Cleaning', 'Plumbing'] },
      { name: 'Delhi NCR Noida (Sector 18 - Sector 62)', code: 'REG-UP-NOI-01', stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'UP-GZB', districtName: 'Gautam Buddha Nagar', cityName: 'Noida', status: 'active', coverageLevel: 'high_demand', targetProviders: 45, serviceCategories: ['AC Repair', 'Cleaning', 'Electrical'] },
      { name: 'Chennai Central & OMR Corridor', code: 'REG-TN-CHN-01', stateCode: 'TN', stateName: 'Tamil Nadu', districtCode: 'TN-CHN', districtName: 'Chennai', cityName: 'Chennai', status: 'active', coverageLevel: 'active', targetProviders: 40, serviceCategories: ['AC Repair', 'Cleaning', 'Plumbing'] },
      { name: 'Kolkata East & New Town', code: 'REG-WB-KOL-01', stateCode: 'WB', stateName: 'West Bengal', districtCode: 'WB-KOL', districtName: 'Kolkata', cityName: 'Kolkata', status: 'active', coverageLevel: 'active', targetProviders: 35, serviceCategories: ['AC Repair', 'Cleaning'] },
    ];

    for (const reg of DEFAULT_REGIONS) {
      await OperationalRegion.updateOne(
        { code: reg.code },
        { ...reg },
        { upsert: true }
      );
    }
    logger.info(`✅ Seeded ${DEFAULT_REGIONS.length} default Operational Regions.`);

    await mongoose.disconnect();
    logger.info('Geo seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    logger.error('Geo seeding failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  seedGeoData();
}

module.exports = seedGeoData;
