import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  User, Cpu, Dice5, Home, DollarSign, Pause, X,
  AlertTriangle, Stethoscope, Zap, Award, CreditCard,
  Rocket, CheckCircle2, Heart, Crown,
  ChevronDown, BarChart2, ArrowUpRight, ArrowDownRight, TrendingUp
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Board constants ──────────────────────────────────────────────────────────
const BOARD_SIZE = 36;
const CORNERS = [0, 9, 18, 27];

const TILE_TYPES = {
  PAYDAY: 'payday', OPPORTUNITY: 'opportunity', THREAT: 'threat',
  HOSPITAL: 'hospital', BLACK_SWAN: 'black_swan', CAREER_SHIFT: 'career_shift',
  DONATION: 'donation', ESTATE: 'estate',
};

const OPP_DECK = [
  { title: 'Startup Seed', msg: 'Invest in local AI startup.', cost: 2000, passive: 500, Icon: Rocket },
  { title: 'Tax Refund', msg: 'Government rebate received.', cash: 1200, Icon: DollarSign },
  { title: 'Real Estate', msg: 'Fractional apartment block.', cost: 5000, passive: 800, Icon: Home },
  { title: 'Bonus Check', msg: 'Quarterly performance bonus.', cash: 2500, Icon: Award },
  { title: 'Side Gig', msg: 'Freelance project completed.', cash: 800, Icon: Award },
  { title: 'Stock Gain', msg: 'Portfolio value increased.', cash: 1500, Icon: TrendingUp },
];

// Threat amounts are generated relative to player salary at draw time
const THREAT_TEMPLATES = [
  { title: 'Car Accident', msg: 'Insurance deductible due.', pct: 0.25, Icon: AlertTriangle },
  { title: 'Luxury Creep', msg: 'Impulse designer purchase.', pct: 0.15, Icon: CreditCard },
  { title: 'Legal Fees', msg: 'Unexpected legal consultation.', pct: 0.30, Icon: Zap },
  { title: 'Home Repair', msg: 'Emergency maintenance expense.', pct: 0.20, Icon: Home },
  { title: 'Medical Bill', msg: 'Out-of-pocket health expense.', pct: 0.22, Icon: Stethoscope },
];

// Draw a threat card scaled to the player's current salary (max 35% of salary, min ₹200)
const drawThreat = (salary) => {
  const tmpl = THREAT_TEMPLATES[Math.floor(Math.random() * THREAT_TEMPLATES.length)];
  const base = Math.round(salary * tmpl.pct);
  // Add ±20% randomness
  const variance = Math.round(base * 0.2);
  const amount = Math.max(200, base + Math.floor(Math.random() * variance * 2) - variance);
  return { ...tmpl, cash: -amount };
};

// ─── Indian city estates ─────────────────────────────────────────────────────
const CITY_DATA = [
  { name: 'Surat', price: 1200, baseRent: 100, houseCost: 300, hotelCost: 1000, houseRents: [200, 400, 700, 1000], hotelRent: 1500, color: '#f59e0b' },
  { name: 'Patna', price: 1400, baseRent: 120, houseCost: 350, hotelCost: 1200, houseRents: [250, 500, 800, 1200], hotelRent: 1800, color: '#f59e0b' },
  { name: 'Jaipur', price: 1800, baseRent: 160, houseCost: 450, hotelCost: 1500, houseRents: [320, 600, 1000, 1500], hotelRent: 2200, color: '#f39c12' },
  { name: 'Ahmedabad', price: 2000, baseRent: 180, houseCost: 500, hotelCost: 1600, houseRents: [360, 700, 1100, 1700], hotelRent: 2500, color: '#f39c12' },
  { name: 'Chennai', price: 2400, baseRent: 220, houseCost: 600, hotelCost: 2000, houseRents: [440, 850, 1300, 2000], hotelRent: 3000, color: '#9579c8' },
  { name: 'Kolkata', price: 2600, baseRent: 240, houseCost: 650, hotelCost: 2200, houseRents: [480, 900, 1400, 2200], hotelRent: 3200, color: '#9579c8' },
  { name: 'Hyderabad', price: 3000, baseRent: 280, houseCost: 750, hotelCost: 2500, houseRents: [560, 1000, 1600, 2600], hotelRent: 3800, color: '#3498db' },
  { name: 'Pune', price: 3200, baseRent: 300, houseCost: 800, hotelCost: 2800, houseRents: [600, 1100, 1800, 2800], hotelRent: 4200, color: '#3498db' },
  { name: 'Delhi', price: 3800, baseRent: 360, houseCost: 950, hotelCost: 3200, houseRents: [720, 1300, 2200, 3500], hotelRent: 5000, color: '#e74c3c' },
  { name: 'Mumbai', price: 4500, baseRent: 440, houseCost: 1100, hotelCost: 4000, houseRents: [880, 1600, 2800, 4500], hotelRent: 6000, color: '#e74c3c' },
];

// Fixed pre-designed board layout: 10 estates, 10 opps, 8 threats, 4 special, 4 corners = 36
// Estates spread across all four sides, specials placed at natural checkpoints
// BLACK_SWAN is tile 14 — kept in dangerous mid-game zone
const BOARD_LAYOUT = [
  // Index: type / city index for estates
  // Row 1 (top, left→right): 0..9
  { type: 'payday' },                      // 0  corner
  { type: 'opportunity' },                   // 1
  { type: 'estate', city: 0 },             // 2  Surat
  { type: 'threat' },                      // 3
  { type: 'opportunity' },                   // 4
  { type: 'hospital' },                      // 5  Bill Due
  { type: 'estate', city: 1 },             // 6  Patna
  { type: 'opportunity' },                   // 7
  { type: 'threat' },                      // 8
  { type: 'payday' },                      // 9  corner
  // Right side (top→bottom): 10..18
  { type: 'estate', city: 2 },             // 10 Jaipur
  { type: 'threat' },                      // 11
  { type: 'opportunity' },                   // 12
  { type: 'estate', city: 3 },             // 13 Ahmedabad
  { type: 'black_swan' },                    // 14 BLACK SWAN (black tile)
  { type: 'opportunity' },                   // 15
  { type: 'estate', city: 4 },             // 16 Chennai
  { type: 'threat' },                      // 17
  { type: 'payday' },                      // 18 corner
  // Bottom row (right→left): 19..27
  { type: 'opportunity' },                   // 19
  { type: 'estate', city: 5 },             // 20 Kolkata
  { type: 'threat' },                      // 21
  { type: 'opportunity' },                   // 22
  { type: 'career_shift' },                  // 23 Market Shift
  { type: 'estate', city: 6 },             // 24 Hyderabad
  { type: 'threat' },                      // 25
  { type: 'opportunity' },                   // 26
  { type: 'payday' },                      // 27 corner
  // Left side (bottom→top): 28..35
  { type: 'estate', city: 7 },             // 28 Pune
  { type: 'opportunity' },                   // 29
  { type: 'threat' },                      // 30
  { type: 'estate', city: 8 },             // 31 Delhi
  { type: 'donation' },                      // 32 Foundation
  { type: 'threat' },                      // 33
  { type: 'opportunity' },                   // 34
  { type: 'estate', city: 9 },             // 35 Mumbai
];

// ─── 15 Board Colour Themes ───────────────────────────────────────────────────
// Each theme defines: name, board bg, center bg, and per-tile-type colours.
// tile keys: payday | fortune | setback | hospital | black_swan | career | charity | estate

const BOARD_THEMES = [
  {
    id: 'classic_monopoly', name: 'Classic Monopoly',
    board: '#ddd8c0', center: '#c8c2a8', boardBorder: '#a09070',
    tiles: {
      payday: { bg: '#00a896', text: '#fff' },
      fortune: { bg: '#d4a017', text: '#fff' },
      setback: { bg: '#c1121f', text: '#fff' },
      hospital: { bg: '#e05252', text: '#fff' },
      black_swan: { bg: '#1a1a1a', text: '#eee' },
      career: { bg: '#1b4f72', text: '#fff' },
      charity: { bg: '#6a0572', text: '#fff' },
      estate: { bg: '#2d6a4f', text: '#fff' },
    },
  },
  {
    id: 'rento_style', name: 'Rento Game',
    board: '#1a1a2e', center: '#16213e', boardBorder: '#0f3460',
    tiles: {
      payday: { bg: '#00d4aa', text: '#000' },
      fortune: { bg: '#ffb703', text: '#000' },
      setback: { bg: '#ef233c', text: '#fff' },
      hospital: { bg: '#ff6b6b', text: '#fff' },
      black_swan: { bg: '#050505', text: '#00d4aa' },
      career: { bg: '#4361ee', text: '#fff' },
      charity: { bg: '#7b2fbe', text: '#fff' },
      estate: { bg: '#06a77d', text: '#fff' },
    },
  },
  {
    id: 'dark_neon', name: 'Dark Neon',
    board: '#0a0a0a', center: '#050505', boardBorder: '#1a1a1a',
    tiles: {
      payday: { bg: '#00ff88', text: '#000' },
      fortune: { bg: '#ffe600', text: '#000' },
      setback: { bg: '#ff0055', text: '#fff' },
      hospital: { bg: '#ff2d87', text: '#fff' },
      black_swan: { bg: '#0a0a0a', text: '#ff0055' },
      career: { bg: '#0099ff', text: '#fff' },
      charity: { bg: '#cc00ff', text: '#fff' },
      estate: { bg: '#ff6600', text: '#fff' },
    },
  },
  {
    id: 'pastel_dreams', name: 'Pastel Dreams',
    board: '#faf7f2', center: '#f0ece5', boardBorder: '#d4c5b0',
    tiles: {
      payday: { bg: '#74c7b8', text: '#fff' },
      fortune: { bg: '#f7c59f', text: '#5a3e28' },
      setback: { bg: '#e88080', text: '#fff' },
      hospital: { bg: '#e8a0b4', text: '#fff' },
      black_swan: { bg: '#4a4a5a', text: '#fff' },
      career: { bg: '#8eb4e3', text: '#fff' },
      charity: { bg: '#c59fd7', text: '#fff' },
      estate: { bg: '#a8d8b9', text: '#3a5a4a' },
    },
  },
  {
    id: 'ocean_deep', name: 'Ocean Deep',
    board: '#0d2137', center: '#071525', boardBorder: '#0a3d62',
    tiles: {
      payday: { bg: '#00b4d8', text: '#fff' },
      fortune: { bg: '#90e0ef', text: '#023e8a' },
      setback: { bg: '#c77dff', text: '#fff' },
      hospital: { bg: '#e63946', text: '#fff' },
      black_swan: { bg: '#03045e', text: '#90e0ef' },
      career: { bg: '#0077b6', text: '#fff' },
      charity: { bg: '#7b2d8b', text: '#fff' },
      estate: { bg: '#0096c7', text: '#fff' },
    },
  },
  {
    id: 'sunset_warm', name: 'Sunset Warm',
    board: '#1a0a00', center: '#120600', boardBorder: '#3d1a00',
    tiles: {
      payday: { bg: '#ff9f1c', text: '#1a0a00' },
      fortune: { bg: '#ffbf69', text: '#3d1a00' },
      setback: { bg: '#c1121f', text: '#fff' },
      hospital: { bg: '#e05c5c', text: '#fff' },
      black_swan: { bg: '#0d0300', text: '#ff9f1c' },
      career: { bg: '#cb4154', text: '#fff' },
      charity: { bg: '#8b2fc9', text: '#fff' },
      estate: { bg: '#e76f51', text: '#fff' },
    },
  },
  {
    id: 'forest_night', name: 'Forest Night',
    board: '#0a1a0a', center: '#050f05', boardBorder: '#1a3a1a',
    tiles: {
      payday: { bg: '#52b788', text: '#fff' },
      fortune: { bg: '#95d5b2', text: '#1b4332' },
      setback: { bg: '#b5451b', text: '#fff' },
      hospital: { bg: '#c77dff', text: '#fff' },
      black_swan: { bg: '#030f03', text: '#95d5b2' },
      career: { bg: '#2d6a4f', text: '#fff' },
      charity: { bg: '#5e548e', text: '#fff' },
      estate: { bg: '#40916c', text: '#fff' },
    },
  },
  {
    id: 'royal_purple', name: 'Royal Purple',
    board: '#1a0a2e', center: '#100520', boardBorder: '#3d1a6e',
    tiles: {
      payday: { bg: '#9b5de5', text: '#fff' },
      fortune: { bg: '#f15bb5', text: '#fff' },
      setback: { bg: '#e63946', text: '#fff' },
      hospital: { bg: '#ff6b9d', text: '#fff' },
      black_swan: { bg: '#07030f', text: '#9b5de5' },
      career: { bg: '#4cc9f0', text: '#0a0a1a' },
      charity: { bg: '#560bad', text: '#fff' },
      estate: { bg: '#7b2d8b', text: '#fff' },
    },
  },
  {
    id: 'cherry_blossom', name: 'Cherry Blossom',
    board: '#fff0f5', center: '#ffe4ef', boardBorder: '#f4acb7',
    tiles: {
      payday: { bg: '#e9838e', text: '#fff' },
      fortune: { bg: '#f4a8bb', text: '#5a1a28' },
      setback: { bg: '#c1121f', text: '#fff' },
      hospital: { bg: '#c77dff', text: '#fff' },
      black_swan: { bg: '#2d1a20', text: '#f4acb7' },
      career: { bg: '#84a98c', text: '#fff' },
      charity: { bg: '#9d4edd', text: '#fff' },
      estate: { bg: '#e57373', text: '#fff' },
    },
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk 2077',
    board: '#080010', center: '#050008', boardBorder: '#2d0050',
    tiles: {
      payday: { bg: '#fcee0a', text: '#000' },
      fortune: { bg: '#00ffd5', text: '#000' },
      setback: { bg: '#ff003c', text: '#fff' },
      hospital: { bg: '#ff0099', text: '#fff' },
      black_swan: { bg: '#000000', text: '#fcee0a' },
      career: { bg: '#00b4ff', text: '#000' },
      charity: { bg: '#bd00ff', text: '#fff' },
      estate: { bg: '#ff6400', text: '#fff' },
    },
  },
  {
    id: 'earth_terracotta', name: 'Earth & Clay',
    board: '#f5e6d3', center: '#ecdcc6', boardBorder: '#c4a882',
    tiles: {
      payday: { bg: '#6b9e6b', text: '#fff' },
      fortune: { bg: '#e8a87c', text: '#3d1a00' },
      setback: { bg: '#9e3b1e', text: '#fff' },
      hospital: { bg: '#c75b6b', text: '#fff' },
      black_swan: { bg: '#1a0d00', text: '#e8a87c' },
      career: { bg: '#5b7a9e', text: '#fff' },
      charity: { bg: '#8b5b9e', text: '#fff' },
      estate: { bg: '#c8773a', text: '#fff' },
    },
  },
  {
    id: 'arctic_ice', name: 'Arctic Ice',
    board: '#e8f4fd', center: '#d0eaf8', boardBorder: '#90c4e4',
    tiles: {
      payday: { bg: '#0077b6', text: '#fff' },
      fortune: { bg: '#90e0ef', text: '#023e8a' },
      setback: { bg: '#d62828', text: '#fff' },
      hospital: { bg: '#e05c8a', text: '#fff' },
      black_swan: { bg: '#03045e', text: '#90e0ef' },
      career: { bg: '#48cae4', text: '#023e8a' },
      charity: { bg: '#7b6daa', text: '#fff' },
      estate: { bg: '#00b4d8', text: '#fff' },
    },
  },
  {
    id: 'gold_rush', name: 'Gold Rush',
    board: '#0d1b2a', center: '#091520', boardBorder: '#1b3a4b',
    tiles: {
      payday: { bg: '#d4af37', text: '#0d1b2a' },
      fortune: { bg: '#f0c040', text: '#1a0f00' },
      setback: { bg: '#c1121f', text: '#fff' },
      hospital: { bg: '#e05c6c', text: '#fff' },
      black_swan: { bg: '#020608', text: '#d4af37' },
      career: { bg: '#b8860b', text: '#fff' },
      charity: { bg: '#7851a9', text: '#fff' },
      estate: { bg: '#cd853f', text: '#fff' },
    },
  },
  {
    id: 'candy_pop', name: 'Candy Pop',
    board: '#ffffff', center: '#f8f0ff', boardBorder: '#e0c0ff',
    tiles: {
      payday: { bg: '#ff595e', text: '#fff' },
      fortune: { bg: '#ffca3a', text: '#3a2000' },
      setback: { bg: '#ff006e', text: '#fff' },
      hospital: { bg: '#c77dff', text: '#fff' },
      black_swan: { bg: '#1a001a', text: '#c77dff' },
      career: { bg: '#4cc9f0', text: '#001a2e' },
      charity: { bg: '#8338ec', text: '#fff' },
      estate: { bg: '#06d6a0', text: '#00302a' },
    },
  },
  {
    id: 'noir', name: 'Noir',
    board: '#1c1c1c', center: '#121212', boardBorder: '#2e2e2e',
    tiles: {
      payday: { bg: '#4a4a4a', text: '#e0e0e0' },
      fortune: { bg: '#606060', text: '#f0f0f0' },
      setback: { bg: '#333333', text: '#cc3333' },
      hospital: { bg: '#3a2a2a', text: '#cc6666' },
      black_swan: { bg: '#080808', text: '#888' },
      career: { bg: '#2a3a4a', text: '#88aacc' },
      charity: { bg: '#3a2a4a', text: '#aa88cc' },
      estate: { bg: '#2a3a2a', text: '#88cc88' },
    },
  },
];

// Default TILE_INFO (used for estate tile name/sub only — colours come from active theme)
const TILE_INFO = {
  payday: { name: 'PAYDAY', sub: null },
  opportunity: { name: 'FORTUNE', sub: null },
  threat: { name: 'SETBACK', sub: null },
  hospital: { name: 'HOSPITAL', sub: null },
  black_swan: { name: 'BLACK SWAN', sub: null },
  career_shift: { name: 'CAREER', sub: null },
  donation: { name: 'CHARITY', sub: null },
};

// Map TILE_INFO key to BOARD_THEMES tile key
const TYPE_TO_THEME_KEY = {
  [TILE_TYPES.PAYDAY]: 'payday',
  [TILE_TYPES.OPPORTUNITY]: 'fortune',
  [TILE_TYPES.THREAT]: 'setback',
  [TILE_TYPES.HOSPITAL]: 'hospital',
  [TILE_TYPES.BLACK_SWAN]: 'black_swan',
  [TILE_TYPES.CAREER_SHIFT]: 'career',
  [TILE_TYPES.DONATION]: 'charity',
  [TILE_TYPES.ESTATE]: 'estate',
};

// ESTATE_TILE_COLOR is now theme-driven — kept as fallback only
const ESTATE_TILE_COLOR = { bg: '#b07d1c', text: '#fff' };

const TILES = BOARD_LAYOUT.map((slot, i) => {
  if (slot.type === 'estate') {
    const city = CITY_DATA[slot.city];
    return {
      id: i, type: TILE_TYPES.ESTATE,
      name: city.name.toUpperCase(),
      sub: `₹${city.price.toLocaleString()}`,
      cityIdx: slot.city,
      cityColor: city.color,
    };
  }
  const info = TILE_INFO[slot.type];
  // map slot.type string → TILE_TYPES enum value
  const typeMap = {
    payday: TILE_TYPES.PAYDAY, opportunity: TILE_TYPES.OPPORTUNITY,
    threat: TILE_TYPES.THREAT, hospital: TILE_TYPES.HOSPITAL,
    black_swan: TILE_TYPES.BLACK_SWAN, career_shift: TILE_TYPES.CAREER_SHIFT,
    donation: TILE_TYPES.DONATION,
  };
  return { id: i, type: typeMap[slot.type], name: info?.name || slot.type, sub: info?.sub || null };
});

// Helper to get the current rent for an estate given its development state
const getEstateRent = (cityIdx, estateState) => {
  const city = CITY_DATA[cityIdx];
  if (!estateState) return city.baseRent;
  if (estateState.hasHotel) return city.hotelRent;
  if (estateState.houses > 0) return city.houseRents[estateState.houses - 1];
  return city.baseRent;
};

const getTilePosition = (index) => {
  if (index <= 9) return { row: 1, col: index + 1 };
  if (index <= 18) return { row: index - 8, col: 10 };
  if (index <= 27) return { row: 10, col: 10 - (index - 18) };
  return { row: 10 - (index - 27), col: 1 };
};

const tilePx = (index, boardPx) => {
  const { row, col } = getTilePosition(index);
  const cell = boardPx / 10;
  return { x: (col - 0.5) * cell, y: (row - 0.5) * cell };
};

// ─── Career difficulty system ─────────────────────────────────────────────────
// Net formula: salary*0.85 − expenses − liability*0.1
//
// Easy:     net ≈ +2500→+4000  zero/tiny debt, low expenses,  big start cash
// Moderate: net ≈ +800→+1800   some debt,      decent expenses, medium start
// Hard:     net ≈ +200→+700    more debt,      higher expenses, low start
// Brutal:   net ≈ +50→+350     heavy debt,     high expenses,   tiny start
//
// All tiers are PLAYABLE (positive net) — brutal is just a grind, not a death spiral.

const PROFESSION_NAMES = {
  easy: ['Pharmacist', 'Software Dev', 'Accountant', 'Financial Analyst', 'Sales Manager'],
  moderate: ['Teacher', 'Graphic Designer', 'Paralegal', 'Journalist', 'HR Manager'],
  hard: ['Freelancer', 'Head Chef', 'Session Musician', 'PT Trainer', 'Startup Founder'],
  brutal: ['PhD Student', 'Barista', 'Street Artist', 'Aspiring Actor', 'Indie Dev'],
};

// salary*0.85 − expenses − liability*0.1 = net
// Easy:     5500*0.85=4675 − 1200 − 300  = +3175  ✓
// Moderate: 4800*0.85=4080 − 2200 − 500  = +1380  ✓
// Hard:     4200*0.85=3570 − 2800 − 600  =  +170  ✓ (worst case still tiny +)
// Brutal:   3500*0.85=2975 − 2400 − 500  =   +75  ✓ (barely positive)
const DIFF_CFG = {
  easy: { label: 'Easy', color: '#2ecc71', salMin: 5000, salMax: 6500, expMin: 900, expMax: 1500, liabMin: 0, liabMax: 2000, savMin: 6000, savMax: 10000 },
  moderate: { label: 'Moderate', color: '#f39c12', salMin: 4200, salMax: 5500, expMin: 1800, expMax: 2600, liabMin: 3000, liabMax: 7000, savMin: 2500, savMax: 4500 },
  hard: { label: 'Hard', color: '#e74c3c', salMin: 3800, salMax: 5000, expMin: 2400, expMax: 3200, liabMin: 5000, liabMax: 12000, savMin: 800, savMax: 2000 },
  brutal: { label: 'Brutal', color: '#9b59b6', salMin: 3200, salMax: 4200, expMin: 2200, expMax: 2800, liabMin: 8000, liabMax: 18000, savMin: 200, savMax: 800 },
};

const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickRnd = arr => arr[Math.floor(Math.random() * arr.length)];

const generateCareer = (diff) => {
  const c = DIFF_CFG[diff];
  return {
    difficulty: diff,
    label: c.label,
    color: c.color,
    name: pickRnd(PROFESSION_NAMES[diff]),
    salary: rnd(c.salMin, c.salMax),
    expenses: rnd(c.expMin, c.expMax),
    liability: rnd(c.liabMin, c.liabMax),
    savings: rnd(c.savMin, c.savMax),
  };
};

const computeNet = (c) => Math.round(c.salary * 0.85) - c.expenses - Math.round(c.liability * 0.1);

// ─── Stock market ─────────────────────────────────────────────────────────────
const INITIAL_STOCKS = [
  { ticker: 'NOVA', name: 'Nova Corp', price: 120, history: [120], trend: 1 },
  { ticker: 'FLUX', name: 'Flux Energy', price: 85, history: [85], trend: -1 },
  { ticker: 'CRED', name: 'CreditEx', price: 200, history: [200], trend: 1 },
  { ticker: 'VEST', name: 'Vestmore', price: 55, history: [55], trend: 1 },
  { ticker: 'RIZE', name: 'RizeTech', price: 310, history: [310], trend: -1 },
];

const tickStocks = (stocks) =>
  stocks.map(s => {
    const delta = (Math.random() - 0.48) * s.price * 0.08 + s.trend * s.price * 0.015;
    const newPrice = Math.max(5, parseFloat((s.price + delta).toFixed(2)));
    return { ...s, price: newPrice, history: [...s.history.slice(-29), newPrice], trend: Math.random() < 0.15 ? -s.trend : s.trend };
  });

// ─── Palette ──────────────────────────────────────────────────────────────────
const D = {
  bg: '#0d0d0d', card: '#141414', panel: '#1c1c1c',
  border: '#2a2a2a', muted: '#444', text: '#e8e8e8', sub: '#666',
  green: '#2ecc71', red: '#e74c3c', blue: '#3498db', purple: '#9579c8',
};

// ─── Ledger Modal ─────────────────────────────────────────────────────────────
function LedgerModal({ player, stocks, onClose }) {
  const taxes = Math.floor(player.salary * 0.15);
  const debtInterest = Math.floor(player.liability * 0.10);
  const netPayday = player.salary + player.passive - player.baseExpenses - taxes - debtInterest;

  const portfolioRows = Object.entries(player.portfolio || {})
    .filter(([, qty]) => qty > 0)
    .map(([ticker, qty]) => {
      const s = stocks.find(s => s.ticker === ticker);
      return { ticker, qty, value: qty * (s?.price ?? 0) };
    });
  const totalPortfolio = portfolioRows.reduce((a, r) => a + r.value, 0);

  const SecTitle = ({ label, color }) => (
    <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color, margin: '0 0 8px' }}>{label}</p>
  );
  const Row = ({ label, value, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${D.border}` }}>
      <span style={{ fontSize: 12, color: D.sub }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: color || D.text, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
  const Box = ({ children }) => (
    <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 12, padding: '10px 14px' }}>{children}</div>
  );
  const Foot = ({ label, value, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
      <span style={{ fontSize: 10, color: D.sub, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 900, color, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.88)', padding: 16 }}>
      <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10, color: D.sub, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>Financial Ledger</p>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: D.text, margin: '2px 0 0' }}>{player.name}</h2>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 8, background: D.panel, border: `1px solid ${D.border}`, color: D.sub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
          <div>
            <SecTitle label="Earnings" color={D.green} />
            <Box>
              <Row label="Active Salary" value={`+₹${player.salary.toLocaleString()}`} color={D.green} />
              <Row label="Passive Income" value={`+₹${player.passive.toLocaleString()}`} color={D.green} />
              {player.isPatron && <Row label="Patron Bonus" value="+20% net" color="#a29bfe" />}
              <Foot label="Total / Payday" value={`₹${(player.salary + player.passive).toLocaleString()}`} color={D.green} />
            </Box>
          </div>

          <div>
            <SecTitle label="Expenses" color={D.red} />
            <Box>
              <Row label="Living Costs" value={`-₹${player.baseExpenses.toLocaleString()}`} color={D.red} />
              <Row label="Income Tax 15%" value={`-₹${taxes.toLocaleString()}`} color={D.red} />
              <Row label="Debt Interest" value={`-₹${debtInterest.toLocaleString()}`} color={D.red} />
              <Foot label="Total / Payday" value={`-₹${(player.baseExpenses + taxes + debtInterest).toLocaleString()}`} color={D.red} />
            </Box>
          </div>

          <div>
            <SecTitle label="Assets" color={D.blue} />
            <Box>
              {player.assets.length === 0 && portfolioRows.length === 0
                ? <p style={{ fontSize: 11, color: D.muted, textAlign: 'center', padding: '6px 0' }}>No assets yet</p> : null}
              {player.assets.map((a, i) => <Row key={i} label={a.name} value={`+₹${a.amount}/mo`} color={D.blue} />)}
              {portfolioRows.map(r => <Row key={r.ticker} label={`${r.ticker} × ${r.qty}`} value={`₹${r.value.toFixed(0)}`} color={D.blue} />)}
              <Foot label="Portfolio Value" value={`₹${totalPortfolio.toFixed(0)}`} color={D.blue} />
            </Box>
          </div>

          <div>
            <SecTitle label="Liabilities" color="#e17055" />
            <Box>
              <Row label="Outstanding Debt" value={`₹${player.liability.toLocaleString()}`} color="#e17055" />
              <Row label="Interest Rate" value="10% / payday" />
              <Foot label="Net / Payday" value={`₹${netPayday.toLocaleString()}`} color={netPayday >= 0 ? D.green : D.red} />
            </Box>
          </div>
        </div>

        <div style={{ padding: '16px 22px', borderTop: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10, color: D.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Cash on Hand</p>
            <p style={{ fontSize: 30, fontWeight: 900, color: D.text, margin: 0, fontFamily: 'monospace' }}>${player.cash.toLocaleString()}</p>
          </div>
          <button onClick={onClose} style={{ padding: '12px 28px', background: '#fff', color: '#000', borderRadius: 10, fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', border: 'none', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Repay Modal ──────────────────────────────────────────────────────────────
function RepayModal({ player, onRepay, onClose }) {
  const [input, setInput] = useState('');
  const maxRepay = Math.min(player.cash, player.liability);
  const amount = parseInt(input.replace(/,/g, '')) || 0;
  const isValid = amount > 0 && amount <= maxRepay;

  const quickPct = (pct) => {
    const val = Math.floor(maxRepay * pct);
    setInput(val.toLocaleString());
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 16 }}>
      <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, width: '100%', maxWidth: 380, overflow: 'hidden' }}>
        <div style={{ height: 3, background: '#e17055' }} />

        <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${D.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: D.text, margin: 0, textTransform: 'uppercase' }}>Repay Debt</h3>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: D.panel, border: `1px solid ${D.border}`, color: D.sub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <div style={{ background: D.panel, borderRadius: 10, padding: '10px 14px', border: `1px solid ${D.border}` }}>
              <p style={{ fontSize: 9, color: D.sub, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Outstanding Debt</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: '#e17055', fontFamily: 'monospace', margin: '2px 0 0' }}>₹${player.liability.toLocaleString()}</p>
            </div>
            <div style={{ background: D.panel, borderRadius: 10, padding: '10px 14px', border: `1px solid ${D.border}` }}>
              <p style={{ fontSize: 9, color: D.sub, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Cash Available</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: D.green, fontFamily: 'monospace', margin: '2px 0 0' }}>${player.cash.toLocaleString()}</p>
            </div>
          </div>

          {/* Quick buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[['25%', 0.25], ['50%', 0.5], ['75%', 0.75], ['All', 1]].map(([label, pct]) => (
              <button key={label} onClick={() => quickPct(pct)}
                style={{ flex: 1, padding: '8px 0', background: D.panel, border: `1px solid ${D.border}`, borderRadius: 8, color: D.sub, fontWeight: 800, fontSize: 11, cursor: 'pointer', textTransform: 'uppercase' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, fontWeight: 900, color: D.sub, fontFamily: 'monospace' }}>$</span>
            <input
              value={input}
              onChange={e => setInput(e.target.value.replace(/[^0-9,]/g, ''))}
              placeholder="Enter amount"
              style={{ width: '100%', padding: '14px 14px 14px 28px', background: D.panel, border: `1px solid ${isValid ? D.green : input ? D.red : D.border}`, borderRadius: 10, color: D.text, fontSize: 18, fontWeight: 900, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {input && !isValid && (
            <p style={{ fontSize: 10, color: D.red, margin: '6px 0 0', fontWeight: 700 }}>
              {amount > player.cash ? 'Insufficient cash' : amount > player.liability ? 'Exceeds total debt' : 'Enter a valid amount'}
            </p>
          )}
        </div>

        <div style={{ padding: '16px 22px', display: 'flex', gap: 10 }}>
          <button onClick={() => { if (isValid) { onRepay(amount); onClose(); } }}
            disabled={!isValid}
            style={{ flex: 1, padding: '13px', background: isValid ? D.green : D.panel, color: isValid ? '#000' : D.muted, borderRadius: 11, fontWeight: 900, fontSize: 13, textTransform: 'uppercase', border: 'none', cursor: isValid ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
            Repay ${amount > 0 ? amount.toLocaleString() : '—'}
          </button>
          <button onClick={onClose}
            style={{ flex: 1, padding: '13px', background: D.panel, color: D.sub, borderRadius: 11, fontWeight: 900, fontSize: 13, textTransform: 'uppercase', border: `1px solid ${D.border}`, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invest Panel ─────────────────────────────────────────────────────────────
function InvestPanel({ open, onClose, stocks, player, playerIdx, onTrade, turn }) {
  const [selectedTicker, setSelectedTicker] = useState('NOVA');
  const [qty, setQty] = useState(1);
  const [dropOpen, setDropOpen] = useState(false);

  const stock = stocks.find(s => s.ticker === selectedTicker) || stocks[0];
  const owned = player?.portfolio?.[selectedTicker] || 0;
  const avgPrice = player?.portfolioMeta?.[selectedTicker]?.avgPrice || null;
  const pnl = (avgPrice !== null && owned > 0) ? ((stock.price - avgPrice) * owned) : null;
  const pnlPct = (avgPrice !== null && avgPrice > 0) ? ((stock.price - avgPrice) / avgPrice * 100) : null;
  const chartData = stock.history.map((price, i) => ({ t: i, price }));
  const priceUp = stock.history.length > 1 && stock.price >= stock.history[stock.history.length - 2];
  const changePct = stock.history[0] ? ((stock.price - stock.history[0]) / stock.history[0] * 100).toFixed(1) : '0.0';
  const isMyTurn = turn === playerIdx && !player?.isAI;
  const canBuy = isMyTurn && !!player && player.cash >= stock.price * qty;
  const canSell = isMyTurn && owned >= qty;

  const Tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 7, padding: '4px 10px', fontSize: 12, color: D.text, fontFamily: 'monospace' }}>${payload[0].value.toFixed(2)}</div>;
  };

  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.45)' }} />}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
        width: 'clamp(280px,22vw,340px)', background: D.card, borderRight: `1px solid ${D.border}`,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={16} color={D.green} />
            <span style={{ fontSize: 14, fontWeight: 900, color: D.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Market</span>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, background: D.panel, border: `1px solid ${D.border}`, color: D.sub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <p style={{ fontSize: 10, color: D.sub, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>Select Stock</p>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setDropOpen(d => !d)} style={{ width: '100%', background: D.panel, border: `1px solid ${D.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', color: D.text }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace' }}>{stock.ticker}</span>
                <span style={{ fontSize: 11, color: D.sub }}>{stock.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: priceUp ? D.green : D.red }}>${stock.price.toFixed(2)}</span>
                <ChevronDown size={13} color={D.sub} />
              </div>
            </button>
            {dropOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: D.panel, border: `1px solid ${D.border}`, borderRadius: 10, zIndex: 200, overflow: 'hidden' }}>
                {stocks.map(s => {
                  const up = s.history.length > 1 && s.price >= s.history[s.history.length - 2];
                  return (
                    <button key={s.ticker} onClick={() => { setSelectedTicker(s.ticker); setDropOpen(false); setQty(1); }}
                      style={{ width: '100%', padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: s.ticker === selectedTicker ? '#222' : 'transparent', cursor: 'pointer', border: 'none', borderBottom: `1px solid ${D.border}`, color: D.text }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'monospace' }}>{s.ticker}</span>
                        <span style={{ fontSize: 10, color: D.sub }}>{s.name}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: up ? D.green : D.red }}>${s.price.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: D.text, fontFamily: 'monospace' }}>${stock.price.toFixed(2)}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {priceUp ? <ArrowUpRight size={14} color={D.green} /> : <ArrowDownRight size={14} color={D.red} />}
              <span style={{ fontSize: 12, fontWeight: 800, color: priceUp ? D.green : D.red }}>{changePct}%</span>
            </div>
          </div>
          <p style={{ fontSize: 9, color: D.sub, margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Session change</p>
        </div>

        <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
          <div style={{ background: D.panel, borderRadius: 12, border: `1px solid ${D.border}`, padding: '8px 4px 4px', height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="t" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip content={<Tip />} />
                <Line type="monotone" dataKey="price" stroke={priceUp ? D.green : D.red} strokeWidth={2} dot={false} animationDuration={300} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <p style={{ fontSize: 10, color: D.sub, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>All Tickers</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {stocks.map(s => {
              const up = s.history.length > 1 && s.price >= s.history[s.history.length - 2];
              const own = player?.portfolio?.[s.ticker] || 0;
              return (
                <button key={s.ticker} onClick={() => { setSelectedTicker(s.ticker); setQty(1); }}
                  style={{ background: s.ticker === selectedTicker ? '#1a2a1a' : D.panel, border: `1px solid ${s.ticker === selectedTicker ? D.green : D.border}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: D.text, fontFamily: 'monospace' }}>{s.ticker}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: up ? D.green : D.red, fontFamily: 'monospace' }}>${s.price.toFixed(0)}</span>
                  </div>
                  {own > 0 && <span style={{ fontSize: 9, color: D.blue, fontWeight: 700 }}>×{own} owned</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '14px 16px', marginTop: 'auto', borderTop: `1px solid ${D.border}`, flexShrink: 0 }}>
          <p style={{ fontSize: 10, color: isMyTurn ? D.sub : D.red, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>
            {isMyTurn ? 'Trade' : 'Trade — Not Your Turn'}
          </p>
          {owned > 0 && (
            <div style={{ background: '#0d1a2a', border: `1px solid ${D.blue}`, borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: D.sub }}>Owned</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: D.blue, fontFamily: 'monospace' }}>{owned} shares</span>
              </div>
              {avgPrice !== null && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: D.sub }}>Avg buy price</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: D.text, fontFamily: 'monospace' }}>${avgPrice.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: D.sub }}>Unrealised P&L</span>
                    <span style={{ fontSize: 11, fontWeight: 900, fontFamily: 'monospace', color: pnl >= 0 ? D.green : D.red }}>
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 34, height: 38, borderRadius: 8, background: D.panel, border: `1px solid ${D.border}`, color: D.text, cursor: 'pointer', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>−</button>
            <input
              type="text"
              inputMode="numeric"
              value={qty}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setQty(raw === '' ? 1 : Math.max(1, parseInt(raw, 10)));
              }}
              onKeyDown={e => { if (!/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)) e.preventDefault(); }}
              onFocus={e => e.target.select()}
              style={{
                width: 0, flex: 1, height: 38, background: D.panel, border: `1px solid ${D.border}`,
                borderRadius: 8, padding: '0 6px', textAlign: 'center',
                fontFamily: 'monospace', fontWeight: 900, color: D.text, fontSize: 15,
                outline: 'none', minWidth: 0,
              }}
            />
            <button onClick={() => setQty(q => q + 1)} style={{ width: 34, height: 38, borderRadius: 8, background: D.panel, border: `1px solid ${D.border}`, color: D.text, cursor: 'pointer', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>+</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: D.sub }}>Total</span>
            <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: D.text }}>${(stock.price * qty).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => canBuy && onTrade('buy', selectedTicker, qty, stock.price)} disabled={!canBuy}
              style={{ flex: 1, padding: '12px', background: canBuy ? D.green : D.panel, color: canBuy ? '#000' : D.muted, borderRadius: 10, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: 'none', cursor: canBuy ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}>Buy</button>
            <button onClick={() => canSell && onTrade('sell', selectedTicker, qty, stock.price)} disabled={!canSell}
              style={{ flex: 1, padding: '12px', background: canSell ? D.red : D.panel, color: canSell ? '#fff' : D.muted, borderRadius: 10, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: 'none', cursor: canSell ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}>Sell</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Money Toast ──────────────────────────────────────────────────────────────
function MoneyToast({ amount, x, y }) {
  const isPos = amount >= 0;
  // Keep toast within viewport horizontally (assume ~80px wide)
  const clampedX = Math.min(Math.max(x, 10), window.innerWidth - 90);
  const clampedY = Math.min(Math.max(y, 20), window.innerHeight - 20);
  return (
    <div style={{
      position: 'fixed',
      left: clampedX,
      top: clampedY,
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
      zIndex: 300,
      animation: 'moneyFloat 2.4s cubic-bezier(0.22,1,0.36,1) forwards',
      fontSize: 'clamp(12px, 1.1vw, 15px)',
      fontWeight: 900,
      fontFamily: 'monospace',
      color: isPos ? '#2ecc71' : '#e74c3c',
      whiteSpace: 'nowrap',
      letterSpacing: '-0.01em',
    }}>
      {isPos ? '+' : ''}${Math.abs(amount).toLocaleString()}
    </div>
  );
}

// ─── Save / FD Modal ─────────────────────────────────────────────────────────

const SAVE_PRODUCTS = [
  { id: 'fd', label: 'Fixed Deposit', shortLabel: 'FD', rate: 0.075, period: 'annual', minAmount: 1000, icon: '🏦', color: '#f39c12', desc: '7.5% p.a. — credited annually' },
  { id: 'ppf', label: 'Public Provident Fund', shortLabel: 'PPF', rate: 0.071, period: 'annual', minAmount: 5000, icon: '📘', color: '#3498db', desc: '7.1% p.a. — credited annually' },
  { id: 'rd', label: 'Recurring Deposit', shortLabel: 'RD', rate: 0.065, period: 'quarterly', minAmount: 500, icon: '🔁', color: '#9579c8', desc: '6.5% p.a. — credited quarterly' },
  { id: 'liq', label: 'Liquid Fund', shortLabel: 'LQ', rate: 0.055, period: 'quarterly', minAmount: 1000, icon: '💧', color: '#2ecc71', desc: '5.5% p.a. — credited quarterly' },
];

function SaveModal({ player, onSave, onClose }) {
  const [selectedId, setSelectedId] = useState('fd');
  const [input, setInput] = useState('');
  const product = SAVE_PRODUCTS.find(p => p.id === selectedId);
  const amount = parseInt(input.replace(/,/g, '')) || 0;
  const isValid = amount >= product.minAmount && amount <= player.cash;
  // Quarterly passive = principal * rate / 4, annual = principal * rate
  const passiveGain = product.period === 'quarterly'
    ? Math.round(amount * product.rate / 4)
    : Math.round(amount * product.rate);
  const periodLabel = product.period === 'quarterly' ? '/quarter' : '/year';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 16 }}>
      <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, width: '100%', maxWidth: 400, overflow: 'hidden' }}>
        <div style={{ height: 3, background: '#f39c12' }} />
        <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${D.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: D.text, margin: 0, textTransform: 'uppercase' }}>Save & Earn</h3>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: D.panel, border: `1px solid ${D.border}`, color: D.sub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
          </div>

          {/* Product selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {SAVE_PRODUCTS.map(p => (
              <button key={p.id} onClick={() => { setSelectedId(p.id); setInput(''); }}
                style={{ background: selectedId === p.id ? `${p.color}18` : D.panel, border: `2px solid ${selectedId === p.id ? p.color : D.border}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{p.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: D.text }}>{p.shortLabel}</div>
                <div style={{ fontSize: 9, color: selectedId === p.id ? p.color : D.sub, fontWeight: 700 }}>{(p.rate * 100).toFixed(1)}% {p.period}</div>
              </button>
            ))}
          </div>

          {/* Selected product info */}
          <div style={{ background: D.panel, borderRadius: 10, padding: '10px 14px', marginBottom: 14, border: `1px solid ${D.border}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: D.sub, margin: '0 0 4px' }}>{product.label}</p>
            <p style={{ fontSize: 11, color: D.text, margin: 0 }}>{product.desc}</p>
            <p style={{ fontSize: 10, color: D.sub, margin: '4px 0 0' }}>Min. investment: ${product.minAmount.toLocaleString()}</p>
          </div>

          {/* Cash info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: D.sub }}>Available Cash</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: D.green, fontFamily: 'monospace' }}>${player.cash.toLocaleString()}</span>
          </div>

          {/* Amount input */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, fontWeight: 900, color: D.sub, fontFamily: 'monospace' }}>$</span>
            <input
              type="text"
              inputMode="numeric"
              value={input}
              onChange={e => setInput(e.target.value.replace(/[^0-9,]/g, ''))}
              onKeyDown={e => { if (!/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab|,/.test(e.key)) e.preventDefault(); }}
              placeholder={`Min ₹${product.minAmount.toLocaleString()}`}
              style={{ width: '100%', padding: '13px 14px 13px 28px', background: D.panel, border: `1px solid ${isValid ? product.color : input ? D.red : D.border}`, borderRadius: 10, color: D.text, fontSize: 17, fontWeight: 900, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Preview */}
          {isValid && (
            <div style={{ background: `${product.color}12`, border: `1px solid ${product.color}44`, borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: D.sub }}>Passive income</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: product.color, fontFamily: 'monospace' }}>+${passiveGain.toLocaleString()}{periodLabel}</span>
            </div>
          )}
          {input && !isValid && (
            <p style={{ fontSize: 10, color: D.red, margin: '6px 0 0', fontWeight: 700 }}>
              {amount < product.minAmount ? `Min ₹${product.minAmount.toLocaleString()}` : 'Insufficient cash'}
            </p>
          )}
        </div>

        <div style={{ padding: '16px 22px', display: 'flex', gap: 10 }}>
          <button onClick={() => { if (isValid) { onSave(amount, product); onClose(); } }}
            disabled={!isValid}
            style={{ flex: 1, padding: '13px', background: isValid ? product.color : D.panel, color: isValid ? '#000' : D.muted, borderRadius: 11, fontWeight: 900, fontSize: 13, textTransform: 'uppercase', border: 'none', cursor: isValid ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
            Invest ${amount > 0 ? amount.toLocaleString() : '—'}
          </button>
          <button onClick={onClose}
            style={{ flex: 1, padding: '13px', background: D.panel, color: D.sub, borderRadius: 11, fontWeight: 900, fontSize: 13, textTransform: 'uppercase', border: `1px solid ${D.border}`, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [gameState, setGameState] = useState('setup');
  const [players, setPlayers] = useState([]);
  const [turn, setTurn] = useState(0);
  const [dice, setDice] = useState([1, 1]);
  const [isRolling, setIsRolling] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [log, setLog] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  const [tileInfoModal, setTileInfoModal] = useState(null); // { tileIdx }
  const [ledgerPlayer, setLedgerPlayer] = useState(null);
  const [repayOpen, setRepayOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [investOpen, setInvestOpen] = useState(false);
  const [setupConfig, setSetupConfig] = useState({ human: 1, ai: 1 });
  const [stocks, setStocks] = useState(INITIAL_STOCKS);
  const [boardPx, setBoardPx] = useState(0);
  const [toasts, setToasts] = useState([]);
  // estates: { [tileIndex]: { ownerId: number|null, houses: 0-4, hasHotel: false } }
  const [estates, setEstates] = useState({});
  const [themeId, setThemeId] = useState('rento_style');
  const [themeDropOpen, setThemeDropOpen] = useState(false);

  // Derive active theme colours
  const activeTheme = BOARD_THEMES.find(t => t.id === themeId) || BOARD_THEMES[1];
  const tileColor = (tile) => {
    const key = TYPE_TO_THEME_KEY[tile.type] || 'estate';
    return activeTheme.tiles[key] || { bg: '#444', text: '#fff' };
  };

  // Career options generated once on mount
  const [careerOptions] = useState(() => [
    generateCareer('easy'),
    generateCareer('moderate'),
    generateCareer('hard'),
    generateCareer('brutal'),
  ]);
  const [selectedDiff, setSelectedDiff] = useState('easy');

  const logEndRef = useRef(null);
  const boardRef = useRef(null);
  const animRef = useRef(null);
  const cardRefs = useRef({});       // keyed by player idx → DOM el
  const playersRef = useRef(players);

  useEffect(() => { playersRef.current = players; }, [players]);

  useEffect(() => {
    const measure = () => { if (boardRef.current) setBoardPx(boardRef.current.offsetWidth); };
    measure();
    const ro = new ResizeObserver(measure);
    if (boardRef.current) ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, [gameState]);

  useEffect(() => { if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [log]);
  useEffect(() => { if (gameState === 'playing') setStocks(prev => tickStocks(prev)); }, [turn, gameState]);
  useEffect(() => () => { if (animRef.current) clearTimeout(animRef.current); }, []);

  const addLog = (msg) => setLog(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, msg }]);

  // Money toast: anchored to right edge of the cash value in the player card,
  // staggered vertically when multiple fire at once for the same player.
  const toastCountRef = useRef({}); // track how many active toasts per player
  const showMoney = useCallback((playerIdx, amount) => {
    const el = cardRefs.current[playerIdx];
    // Fallback position — right side near player list
    let x = window.innerWidth - 32;
    let y = window.innerHeight - 80 - (players.length - 1 - playerIdx) * 90;
    if (el) {
      const r = el.getBoundingClientRect();
      // Right edge of the card (where cash number sits)
      x = r.right - 16;
      y = r.top + r.height / 2;
    }
    // Stagger: count existing toasts for this player and offset vertically
    const activeCount = (toastCountRef.current[playerIdx] || 0);
    toastCountRef.current[playerIdx] = activeCount + 1;
    const staggerY = y - activeCount * 28; // push each new one up 28px
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, playerIdx, amount, x, y: staggerY }]);
    const duration = 2400;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      toastCountRef.current[playerIdx] = Math.max(0, (toastCountRef.current[playerIdx] || 1) - 1);
    }, duration);
  }, [players.length]);

  // ── Save / FD ──────────────────────────────────────────────────────────────
  const handleSave = (amount, product) => {
    setPlayers(prev => {
      const p = prev[turn];
      if (!p || p.cash < amount) return prev;
      const updated = [...prev];
      const passiveGain = product.period === 'quarterly'
        ? Math.round(amount * product.rate / 4)
        : Math.round(amount * product.rate);
      updated[turn] = {
        ...p,
        cash: p.cash - amount,
        passive: p.passive + passiveGain,
        assets: [...p.assets, { name: `${product.label} (${(product.rate * 100).toFixed(1)}%)`, amount: passiveGain }],
      };
      addLog(`${p.name} invested ₹${amount.toLocaleString()} in ${product.shortLabel} → +₹${passiveGain.toLocaleString()}${product.period === 'quarterly' ? '/qtr' : '/yr'} passive`);
      return updated;
    });
    showMoney(turn, -amount);
  };

  // ── Repay ──────────────────────────────────────────────────────────────────
  const handleRepay = (amount) => {
    setPlayers(prev => {
      const p = prev[turn];
      if (!p || p.isAI || p.liability <= 0 || p.cash < amount) return prev;
      const updated = [...prev];
      const newLiab = Math.max(0, p.liability - amount);
      updated[turn] = { ...p, cash: p.cash - amount, liability: newLiab };
      addLog(`${p.name} repaid ₹${amount.toLocaleString()}. Debt: ₹${newLiab.toLocaleString()}`);
      return updated;
    });
    showMoney(turn, -amount);
  };

  // ── Trade ──────────────────────────────────────────────────────────────────
  const handleTrade = (action, ticker, qty, price) => {
    const cost = price * qty;
    setPlayers(prev => {
      const p = { ...prev[turn] };
      const portfolio = { ...(p.portfolio || {}) };
      // portfolioMeta stores { qty, avgPrice } per ticker
      const meta = { ...(p.portfolioMeta || {}) };
      if (action === 'buy') {
        if (p.cash < cost) return prev;
        p.cash -= cost;
        const prevQty = portfolio[ticker] || 0;
        const prevAvg = meta[ticker]?.avgPrice || 0;
        const newQty = prevQty + qty;
        const newAvg = prevQty === 0
          ? price
          : ((prevAvg * prevQty) + (price * qty)) / newQty;
        portfolio[ticker] = newQty;
        meta[ticker] = { avgPrice: parseFloat(newAvg.toFixed(2)) };
        addLog(`${p.name} BOUGHT ${qty}× ${ticker} @ ₹${price.toFixed(2)}`);
      } else {
        if ((portfolio[ticker] || 0) < qty) return prev;
        p.cash += cost;
        portfolio[ticker] -= qty;
        if (portfolio[ticker] === 0) delete meta[ticker];
        addLog(`${p.name} SOLD ${qty}× ${ticker} @ ₹${price.toFixed(2)}`);
      }
      p.portfolio = portfolio;
      p.portfolioMeta = meta;
      const updated = [...prev];
      updated[turn] = p;
      return updated;
    });
    showMoney(turn, action === 'buy' ? -cost : cost);
  };

  // ── Estate actions ────────────────────────────────────────────────────────
  const handleBuyEstate = (pos, cityIdx) => {
    const city = CITY_DATA[cityIdx];
    setPlayers(prev => {
      const p = prev[turn];
      if (p.cash < city.price) return prev;
      const u = [...prev];
      u[turn] = { ...p, cash: p.cash - city.price };
      addLog(`${p.name} BOUGHT ${city.name} ₹${city.price.toLocaleString()}`);
      return u;
    });
    setEstates(prev => ({ ...prev, [pos]: { ownerId: turn, houses: 0, hasHotel: false } }));
    showMoney(turn, -city.price);
    setActiveModal({
      type: 'simple_info',
      title: city.name,
      msg: `Property purchased! Other players who land here must now pay you rent. Build houses to increase the rent.`,
      Icon: Home,
      iconColor: city.color,
      amountLine: { label: 'Purchased', value: `-₹${city.price.toLocaleString()}`, color: D.red },
    });
  };

  const handlePayBankRent = (pos, cityIdx) => {
    const city = CITY_DATA[cityIdx];
    const rent = city.baseRent;
    setPlayers(prev => {
      const p = prev[turn];
      let cash = p.cash - rent, liab = p.liability;
      if (cash < 0) { liab += Math.abs(cash); cash = 0; }
      const u = [...prev];
      u[turn] = { ...p, cash, liability: liab };
      addLog(`${p.name} paid bank rent ₹${rent} at ${city.name}`);
      return u;
    });
    showMoney(turn, -rent);
    setActiveModal({
      type: 'simple_info',
      title: city.name,
      msg: `Bank rent paid for passing through. Buy it next time to collect rent from other players!`,
      Icon: Home,
      iconColor: ESTATE_TILE_COLOR.bg,
      amountLine: { label: 'Bank Rent Paid', value: `-₹${rent.toLocaleString()}`, color: D.red },
    });
  };

  const handleBuildOnEstate = (pos, cityIdx, buildType) => {
    const city = CITY_DATA[cityIdx];
    const cost = buildType === 'hotel' ? city.hotelCost : city.houseCost;
    setPlayers(prev => {
      const p = prev[turn];
      if (p.cash < cost) return prev;
      const u = [...prev];
      u[turn] = { ...p, cash: p.cash - cost };
      addLog(`${p.name} built ${buildType} on ${city.name} (-₹${cost.toLocaleString()})`);
      return u;
    });
    setEstates(prev => {
      const cur = prev[pos] || { ownerId: turn, houses: 0, hasHotel: false };
      return {
        ...prev,
        [pos]: buildType === 'hotel'
          ? { ...cur, hasHotel: true, houses: 4 }
          : { ...cur, houses: Math.min(4, (cur.houses || 0) + 1) },
      };
    });
    showMoney(turn, -cost);
    setActiveModal(null);
  };

  // ── Next turn ──────────────────────────────────────────────────────────────
  const nextTurn = useCallback(() => {
    const cur = playersRef.current;
    if (cur[turn]?.passive >= 5000) { setGameState('gameover'); return; }
    setHasMoved(false);
    setActiveModal(null);
    setInvestOpen(false);
    setTurn(t => (t + 1) % cur.length);
  }, [turn]);

  // ── Landing ────────────────────────────────────────────────────────────────
  const doLand = useCallback((playerIdx, pos, rollSum) => {
    const tile = TILES[pos];
    let eff = { logs: [], money: [], modal: null, nextTurn: false, estates: null };

    setPlayers(prev => {
      const player = prev[playerIdx];
      const u = [...prev];
      eff = { logs: [], money: [], modal: null, nextTurn: false, estates: null };

      switch (tile.type) {
        case TILE_TYPES.OPPORTUNITY: {
          const card = OPP_DECK[Math.floor(Math.random() * OPP_DECK.length)];
          if (player.isAI) {
            if (card.cost && player.cash >= card.cost) {
              u[playerIdx] = { ...player, cash: Math.round(player.cash - card.cost), passive: player.passive + (card.passive || 0), assets: [...player.assets, { name: card.title, amount: card.passive }] };
              eff.logs.push(`${player.name} ACQUIRED: ${card.title}`);
              eff.money.push({ idx: playerIdx, amt: -card.cost });
            } else if (card.cash) {
              u[playerIdx] = { ...player, cash: Math.round(player.cash + card.cash) };
              eff.logs.push(`${player.name} GAIN: ${card.title} +₹${card.cash.toLocaleString()}`);
              eff.money.push({ idx: playerIdx, amt: card.cash });
            }
            eff.nextTurn = true;
          } else eff.modal = { type: 'card', card, flavor: 'opportunity' };
          break;
        }
        case TILE_TYPES.THREAT: {
          const card = drawThreat(player.salary);
          if (player.isAI) {
            let cash = Math.round(player.cash + card.cash), liab = player.liability;
            if (cash < 0) { liab += Math.abs(cash); cash = 0; }
            u[playerIdx] = { ...player, cash, liability: liab };
            eff.logs.push(`${player.name} LOSS: ${card.title} (₹${Math.abs(card.cash).toLocaleString()})`);
            eff.money.push({ idx: playerIdx, amt: card.cash });
            eff.nextTurn = true;
          } else {
            // Human: DON'T apply cash here — processCard handles it on Acknowledge
            eff.logs.push(`${player.name} BILL: ${card.title}`);
            eff.modal = { type: 'card', card, flavor: 'threat' };
          }
          break;
        }
        case TILE_TYPES.DONATION:
          if (player.isPatron) {
            eff.logs.push(`${player.name}: Charity tile visited.`);
            if (player.isAI) eff.nextTurn = true;
          } else if (player.isAI) {
            if (player.cash >= 3000) {
              u[playerIdx] = { ...player, cash: player.cash - 3000, isPatron: true };
              eff.logs.push(`${player.name} Patron active.`);
              eff.money.push({ idx: playerIdx, amt: -3000 });
            }
            eff.nextTurn = true;
          } else eff.modal = { type: 'donation' };
          break;
        case TILE_TYPES.CAREER_SHIFT: {
          let bump = 0, msg = '';
          if (rollSum >= 11) { bump = 1000; msg = 'PROMOTED! Your salary increases by ₹1,000/month from next payday.'; }
          else if (rollSum % 2 !== 0) { bump = -500; msg = 'DEMOTED! Your salary drops by ₹500/month from next payday.'; }
          else msg = 'Market conditions stable. No change to your salary.';
          u[playerIdx] = { ...player, salary: Math.max(500, player.salary + bump) };
          eff.logs.push(`${player.name}: ${bump > 0 ? '+' : ''}₹${bump} salary`);
          if (player.isAI) { eff.nextTurn = true; }
          else eff.modal = { type: 'simple_info', title: 'Career', msg, Icon: Award, iconColor: '#3d5afe' };
          break;
        }
        case TILE_TYPES.HOSPITAL: {
          const bill = 2500 + Math.floor(Math.random() * 5000);
          let cash = player.cash - bill, liab = player.liability;
          if (cash < 0) { liab += Math.abs(cash); cash = 0; }
          u[playerIdx] = { ...player, cash, liability: liab };
          eff.logs.push(`${player.name} MEDICAL: -₹${bill}`);
          eff.money.push({ idx: playerIdx, amt: -bill });
          if (player.isAI) { eff.nextTurn = true; }
          else eff.modal = {
            type: 'simple_info', title: 'Medical Bill',
            msg: `₹${bill.toLocaleString()} has been debited from your account as a hospital bill.${liab > player.liability ? ` ₹${(liab - player.liability).toLocaleString()} added to your debt.` : ''}`,
            Icon: Stethoscope, iconColor: D.red,
            amountLine: { label: 'Debited', value: `-₹${bill.toLocaleString()}`, color: D.red },
          };
          break;
        }
        case TILE_TYPES.BLACK_SWAN: {
          const isCrash = Math.random() > 0.5;
          let delta = 0, msg = '';
          if (isCrash) {
            delta = -Math.floor(player.cash * 0.4);
            msg = `Bank default! ₹${Math.abs(delta).toLocaleString()} (40% of your cash) has been seized.`;
            u[playerIdx] = { ...player, cash: player.cash + delta };
          } else {
            msg = `Market crash! Your passive income has been halved to ₹${Math.floor(player.passive * 0.5).toLocaleString()}/month.`;
            u[playerIdx] = { ...player, passive: Math.floor(player.passive * 0.5) };
          }
          eff.logs.push(`${player.name} LIFE EVENT: ${isCrash ? '-40% cash' : 'passive halved'}`);
          if (isCrash) eff.money.push({ idx: playerIdx, amt: delta });
          if (player.isAI) { eff.nextTurn = true; }
          else eff.modal = {
            type: 'simple_info', title: 'Life Event', msg, Icon: Zap, iconColor: '#e67e22',
            amountLine: isCrash
              ? { label: 'Seized', value: `-₹${Math.abs(delta).toLocaleString()}`, color: D.red }
              : { label: 'New Passive', value: `₹${Math.floor(player.passive * 0.5).toLocaleString()}/mo`, color: '#e67e22' },
          };
          break;
        }
        case TILE_TYPES.ESTATE: {
          const cityIdx = tile.cityIdx;
          const city = CITY_DATA[cityIdx];
          const estState = estates[pos];
          const ownerId = estState?.ownerId ?? null;
          const rent = getEstateRent(cityIdx, estState);

          if (ownerId === null) {
            // Unowned
            if (player.isAI) {
              if (player.cash >= city.price) {
                // AI buys
                u[playerIdx] = { ...player, cash: player.cash - city.price };
                eff.estates = { pos, val: { ownerId: playerIdx, houses: 0, hasHotel: false } };
                eff.logs.push(`${player.name} BOUGHT ${city.name} for ₹${city.price.toLocaleString()}`);
                eff.money.push({ idx: playerIdx, amt: -city.price });
              } else {
                // AI pays bank rent
                let cash = player.cash - rent, liab = player.liability;
                if (cash < 0) { liab += Math.abs(cash); cash = 0; }
                u[playerIdx] = { ...player, cash, liability: liab };
                eff.logs.push(`${player.name} paid bank rent ₹${rent.toLocaleString()} at ${city.name}`);
                eff.money.push({ idx: playerIdx, amt: -rent });
              }
              eff.nextTurn = true;
            } else if (player.cash >= city.price) {
              // Human can afford to buy — show choice modal
              eff.modal = { type: 'estate_unowned', pos, cityIdx, rent, canBuy: true };
            } else {
              // Human cannot afford — auto-debit rent silently and show acknowledgement
              let cash = player.cash - rent, liab = player.liability;
              if (cash < 0) { liab += Math.abs(cash); cash = 0; }
              u[playerIdx] = { ...player, cash, liability: liab };
              eff.logs.push(`${player.name} paid bank rent ₹${rent.toLocaleString()} at ${city.name}`);
              eff.money.push({ idx: playerIdx, amt: -rent });
              eff.modal = {
                type: 'simple_info', title: city.name,
                msg: `You can't afford to buy this property (₹${city.price.toLocaleString()}). Bank rent has been automatically debited.`,
                Icon: Home, iconColor: ESTATE_TILE_COLOR.bg,
                amountLine: { label: 'Bank Rent Paid', value: `-₹${rent.toLocaleString()}`, color: D.red },
              };
            }
          } else if (ownerId === playerIdx) {
            // Own it — offer to build
            if (player.isAI) {
              const canBuildHouse = !estState.hasHotel && estState.houses < 4 && player.cash >= city.houseCost;
              if (canBuildHouse) {
                u[playerIdx] = { ...player, cash: player.cash - city.houseCost };
                eff.estates = { pos, val: { ...estState, houses: (estState.houses || 0) + 1 } };
                eff.logs.push(`${player.name} built house on ${city.name}`);
                eff.money.push({ idx: playerIdx, amt: -city.houseCost });
              }
              eff.nextTurn = true;
            } else {
              eff.modal = { type: 'estate_own', pos, cityIdx, estState };
            }
          } else {
            // Owned by another player — pay rent
            const rentDue = rent;
            let cash = player.cash - rentDue, liab = player.liability;
            if (cash < 0) { liab += Math.abs(cash); cash = 0; }
            u[playerIdx] = { ...player, cash, liability: liab };
            // Credit rent to owner
            const ownerIdx = ownerId;
            u[ownerIdx] = { ...u[ownerIdx], cash: u[ownerIdx].cash + rentDue };

            eff.logs.push(`${player.name} paid ₹${rentDue.toLocaleString()} rent to ${u[ownerIdx].name} at ${city.name}`);
            eff.money.push({ idx: playerIdx, amt: -rentDue });
            eff.money.push({ idx: ownerIdx, amt: rentDue });
            if (player.isAI) eff.nextTurn = true;
            else eff.modal = {
              type: 'simple_info', title: `${city.name}`,
              msg: `${u[ownerIdx].name} owns this property. You've paid rent.`,
              Icon: Home, iconColor: city.color,
              amountLine: { label: 'Rent Paid', value: `-₹${rentDue.toLocaleString()}`, color: D.red },
            };
          }
          break;
        }
        default:
          if (player.isAI) eff.nextTurn = true;
      }
      return u;
    });

    eff.logs.forEach(msg => addLog(msg));
    eff.money.forEach(m => showMoney(m.idx, m.amt));
    if (eff.estates) setEstates(prev => ({ ...prev, [eff.estates.pos]: eff.estates.val }));
    if (eff.modal) setActiveModal(eff.modal);
    if (eff.nextTurn) setTimeout(() => nextTurn(), 600);
  }, [nextTurn, showMoney, estates]);

  // ── Step animation ─────────────────────────────────────────────────────────
  const animateMove = useCallback((playerIdx, fromPos, steps, rollSum) => {
    setIsAnimating(true);
    let currentPos = fromPos;
    let remaining = steps;
    const passedCorners = [];

    const step = () => {
      if (remaining <= 0) {
        // Apply all payday credits
        let paydayEff = { logs: [], money: [] };
        setPlayers(prev => {
          let p = { ...prev[playerIdx] };
          paydayEff = { logs: [], money: [] };
          passedCorners.forEach(() => {
            let net = Math.round((p.salary + p.passive) - (p.baseExpenses + Math.round(p.liability * 0.1) + Math.round(p.salary * 0.15)));
            if (p.isPatron) net = Math.round(net * 1.2);
            p.cash += net;
            paydayEff.logs.push(`${p.name} PAYDAY: +₹${net.toLocaleString()}`);
            paydayEff.money.push({ idx: playerIdx, amt: net });
          });
          const u = [...prev];
          u[playerIdx] = p;
          return u;
        });

        paydayEff.logs.forEach(msg => addLog(msg));
        paydayEff.money.forEach(m => showMoney(m.idx, m.amt));

        setIsAnimating(false);
        setTimeout(() => doLand(playerIdx, currentPos, rollSum), 120);
        return;
      }

      currentPos = (currentPos + 1) % BOARD_SIZE;
      remaining--;

      if (CORNERS.includes(currentPos) && currentPos !== fromPos) passedCorners.push(currentPos);

      setPlayers(prev => {
        const u = [...prev];
        u[playerIdx] = { ...u[playerIdx], displayPos: currentPos };
        return u;
      });

      const delay = CORNERS.includes(currentPos) ? 360 : remaining === 0 ? 280 : 190;
      animRef.current = setTimeout(step, delay);
    };

    animRef.current = setTimeout(step, 80);
  }, [doLand, showMoney]);

  // ── Roll ───────────────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (isRolling || isAnimating || hasMoved || gameState !== 'playing' || activeModal) return;
    setIsRolling(true);

    let shakes = 0;
    const shake = () => {
      setDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]);
      if (++shakes < 7) setTimeout(shake, 75);
    };
    shake();

    setTimeout(() => {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      setDice([d1, d2]);
      setIsRolling(false);
      setHasMoved(true);

      const fromPos = playersRef.current[turn].position;
      const steps = d1 + d2;
      const toPos = (fromPos + steps) % BOARD_SIZE;

      setPlayers(prev => {
        const u = [...prev];
        u[turn] = { ...u[turn], position: toPos, displayPos: u[turn].displayPos ?? fromPos };
        return u;
      });

      animateMove(turn, fromPos, steps, d1 + d2);
    }, 560);
  }, [isRolling, isAnimating, hasMoved, gameState, activeModal, turn, animateMove]);

  // ── Card / donation ────────────────────────────────────────────────────────
  const processCard = useCallback((idx, card) => {
    let cardEff = { logs: [], money: [] };
    setPlayers(prev => {
      const p = prev[idx];
      const u = [...prev];
      cardEff = { logs: [], money: [] };
      if (card.cost && p.cash >= card.cost) {
        u[idx] = { ...p, cash: Math.round(p.cash - card.cost), passive: p.passive + (card.passive || 0), assets: [...p.assets, { name: card.title, amount: card.passive }] };
        cardEff.logs.push(`${p.name} ACQUIRED: ${card.title}`);
        cardEff.money.push({ idx, amt: -card.cost });
      } else if (card.cash) {
        let cash = Math.round(p.cash + card.cash), liab = p.liability;
        if (cash < 0) { liab += Math.abs(cash); cash = 0; }
        u[idx] = { ...p, cash, liability: liab };
        cardEff.logs.push(`${p.name} ${card.cash > 0 ? 'GAIN' : 'LOSS'}: ${card.title} (₹${Math.abs(card.cash).toLocaleString()})`);
        cardEff.money.push({ idx, amt: card.cash });
      }
      return u;
    });
    cardEff.logs.forEach(msg => addLog(msg));
    cardEff.money.forEach(m => showMoney(m.idx, m.amt));
    setActiveModal(null);
  }, [showMoney]);

  const applyDonation = useCallback((idx) => {
    let donEff = false;
    setPlayers(prev => {
      const p = prev[idx];
      if (p.cash < 3000) return prev;
      const u = [...prev];
      u[idx] = { ...p, cash: p.cash - 3000, isPatron: true };
      donEff = true;
      return u;
    });
    if (donEff) {
      addLog(`${playersRef.current[idx].name} Patron status active.`);
      showMoney(idx, -3000);
    }
    setActiveModal(null);
  }, [showMoney]);

  // ── Init ───────────────────────────────────────────────────────────────────
  const initGame = () => {
    const total = setupConfig.human + setupConfig.ai;
    const humanCareer = careerOptions.find(c => c.difficulty === selectedDiff);

    setPlayers(Array.from({ length: total }, (_, i) => {
      // AI players get same difficulty as human — generates a fresh random career
      // within the same tier so stats vary but financial pressure is matched
      const career = i < setupConfig.human
        ? humanCareer
        : generateCareer(selectedDiff);
      return {
        id: i, name: i < setupConfig.human ? `Player ${i + 1}` : `AI ${i - setupConfig.human + 1}`,
        isAI: i >= setupConfig.human, cash: career.savings, salary: career.salary,
        baseExpenses: career.expenses, passive: 0, liability: career.liability,
        position: 0, displayPos: 0, career: career.name, isPatron: false,
        assets: [], portfolio: {}, portfolioMeta: {},
        color: ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f'][i % 4],
      };
    }));
    setGameState('playing');
  };

  // ── AI ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState === 'playing' && players[turn]?.isAI && !isRolling && !isAnimating && !activeModal) {
      const t = setTimeout(() => { if (!hasMoved) handleRoll(); else nextTurn(); }, 1100);
      return () => clearTimeout(t);
    }
  }, [turn, gameState, players, isRolling, isAnimating, activeModal, hasMoved, handleRoll, nextTurn]);

  const currentPlayer = players[turn];

  // ─── Setup Screen ──────────────────────────────────────────────────────────
  if (gameState === 'setup') {
    const DiffCard = ({ career }) => {
      const net = computeNet(career);
      const selected = selectedDiff === career.difficulty;
      return (
        <div onClick={() => setSelectedDiff(career.difficulty)} style={{
          background: selected ? `${career.color}14` : D.panel,
          border: `2px solid ${selected ? career.color : D.border}`,
          borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
          transition: 'all 0.18s', position: 'relative',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {selected && <div style={{ position: 'absolute', top: 8, right: 8 }}><CheckCircle2 size={13} color={career.color} /></div>}
          <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: career.color, background: `${career.color}22`, padding: '2px 7px', borderRadius: 20, display: 'inline-block', width: 'fit-content' }}>
            {career.label}
          </span>
          <p style={{ fontSize: 13, fontWeight: 900, color: D.text, margin: 0, lineHeight: 1.2 }}>{career.name}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: `1px solid ${D.border}` }}>
            <div>
              <p style={{ fontSize: 8, color: D.sub, fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Starts at</p>
              <p style={{ fontSize: 13, fontWeight: 900, color: D.blue, fontFamily: 'monospace', margin: 0 }}>₹{career.savings.toLocaleString()}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 8, color: D.sub, fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Net/Payday</p>
              <p style={{ fontSize: 13, fontWeight: 900, color: net >= 0 ? D.green : D.red, fontFamily: 'monospace', margin: 0 }}>{net >= 0 ? '+' : ''}₹{net.toLocaleString()}</p>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif', overflowY: 'auto' }}>
        <style>{`
          @keyframes spinOnce { 0% { transform: rotate(-35deg); } 100% { transform: rotate(35deg); } }
          @media (max-width: 900px) and (orientation: portrait) { #portrait-warning { display: flex !important; } }
        `}</style>
        <div id="portrait-warning" style={{ display: 'none', position: 'fixed', inset: 0, zIndex: 9999, background: '#0d0d0d', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32, gap: 20 }}>
          <div style={{ fontSize: 56 }}>📱</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#e8e8e8', margin: 0, textTransform: 'uppercase' }}>Rotate Device</h2>
          <p style={{ fontSize: 14, color: '#666', margin: 0, maxWidth: 260, lineHeight: 1.6 }}>StraFi is best played in <strong style={{ color: '#e8e8e8' }}>landscape mode</strong>.<br />Please rotate your device.</p>
          <div style={{ width: 56, height: 56, border: '3px solid #2a2a2a', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, animation: 'spinOnce 1.5s ease-in-out infinite alternate' }}>⟳</div>
        </div>
        <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 22, padding: 'clamp(24px,3vw,40px)', maxWidth: 540, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ fontSize: 'clamp(40px,6vw,60px)', fontWeight: 900, letterSpacing: '-0.04em', color: D.text, margin: 0 }}>StraFi</h1>
            <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3em', color: D.sub, margin: '4px 0 0' }}>Strategize your Finance</p>
          </div>

          {/* Player counts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {[{ k: 'human', l: 'Human Players', Icon: User }, { k: 'ai', l: 'AI Agents', Icon: Cpu }].map(t => (
              <div key={t.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: D.panel, padding: '12px 16px', borderRadius: 12, border: `1px solid ${D.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.sub }}>
                  <t.Icon size={16} /><span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.l}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => setSetupConfig(s => ({ ...s, [t.k]: Math.max(0, s[t.k] - 1) }))}
                    style={{ width: 30, height: 30, borderRadius: 8, background: D.border, border: 'none', color: D.text, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>−</button>
                  <span style={{ fontSize: 17, fontWeight: 900, color: D.text, minWidth: 20, textAlign: 'center' }}>{setupConfig[t.k]}</span>
                  <button onClick={() => setSetupConfig(s => ({ ...s, [t.k]: Math.min(4, s[t.k] + 1) }))}
                    style={{ width: 30, height: 30, borderRadius: 8, background: D.border, border: 'none', color: D.text, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Career / Difficulty */}
          <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: D.sub, marginBottom: 12 }}>
            Select Career & Difficulty
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
            {careerOptions.map(c => <DiffCard key={c.difficulty} career={c} />)}
          </div>

          <button onClick={initGame} disabled={setupConfig.human + setupConfig.ai < 2}
            style={{ width: '100%', padding: '15px', background: setupConfig.human + setupConfig.ai >= 2 ? '#fff' : D.muted, color: '#000', borderRadius: 14, fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.15em', border: 'none', cursor: setupConfig.human + setupConfig.ai >= 2 ? 'pointer' : 'not-allowed' }}>
            Begin Game
          </button>
        </div>
      </div>
    );
  }

  // ─── Playing Screen ────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100vh', background: D.bg, color: D.text, overflow: 'hidden', userSelect: 'none', fontFamily: 'system-ui,sans-serif' }}>
      {/* Portrait mode blocker — only shown via CSS media query */}
      <div id="portrait-warning" style={{
        display: 'none', position: 'fixed', inset: 0, zIndex: 9999,
        background: D.bg, flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: 32, gap: 20,
      }}>
        <div style={{ fontSize: 56, marginBottom: 4 }}>📱</div>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: D.text, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Rotate Device</h2>
        <p style={{ fontSize: 14, color: D.sub, margin: 0, maxWidth: 260, lineHeight: 1.6 }}>
          StraFi is best played in <strong style={{ color: D.text }}>landscape mode</strong>.<br />Please rotate your device to continue.
        </p>
        <div style={{ width: 60, height: 60, border: `3px solid ${D.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, animation: 'spinOnce 1.5s ease-in-out infinite alternate' }}>⟳</div>
      </div>
      <style>{`
        @keyframes pawnBounce {
          0%   { transform: scale(1) translateY(0); }
          40%  { transform: scale(1.3) translateY(-7px); }
          70%  { transform: scale(0.93) translateY(2px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes moneyFloat {
          0%   { opacity: 0; transform: translateY(-50%) translateX(8px) scale(0.8); }
          12%  { opacity: 1; transform: translateY(-50%) translateX(0px) scale(1.08); }
          30%  { opacity: 1; transform: translateY(calc(-50% - 8px)) translateX(-4px) scale(1); }
          75%  { opacity: 0.85; transform: translateY(calc(-50% - 30px)) translateX(-8px) scale(0.97); }
          100% { opacity: 0;   transform: translateY(calc(-50% - 60px)) translateX(-12px) scale(0.9); }
        }
        @keyframes spinOnce {
          0%   { transform: rotate(-35deg); }
          100% { transform: rotate(35deg); }
        }
        @media (max-width: 900px) and (orientation: portrait) {
          #portrait-warning { display: flex !important; }
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      {/* Money Toasts */}
      {toasts.map(t => <MoneyToast key={t.id} amount={t.amount} x={t.x} y={t.y} />)}

      {/* Invest Panel */}
      <InvestPanel open={investOpen} onClose={() => setInvestOpen(false)} stocks={stocks} player={currentPlayer} playerIdx={turn} onTrade={handleTrade} turn={turn} />

      {/* Theme Selector — top-left */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 50 }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setThemeDropOpen(o => !o)}
            style={{ height: 36, padding: '0 12px', background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: D.text, fontSize: 11, fontWeight: 700 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: activeTheme.tiles.estate.bg, flexShrink: 0, border: `1px solid rgba(255,255,255,0.2)` }} />
            <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTheme.name}</span>
            <ChevronDown size={12} color={D.sub} style={{ transform: themeDropOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }} />
          </button>

          {themeDropOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, zIndex: 200, width: 220, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px 6px', borderBottom: `1px solid ${D.border}` }}>
                <p style={{ fontSize: 9, color: D.sub, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>Board Theme</p>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {BOARD_THEMES.map(theme => (
                  <button key={theme.id} onClick={() => { setThemeId(theme.id); setThemeDropOpen(false); }}
                    style={{ width: '100%', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10, background: theme.id === themeId ? '#252525' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: `1px solid ${D.border}` }}>
                    {/* Colour swatch row */}
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      {['estate', 'fortune', 'setback', 'payday', 'career'].map(k => (
                        <div key={k} style={{ width: 9, height: 20, borderRadius: 2, background: theme.tiles[k]?.bg || '#888' }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: theme.id === themeId ? 900 : 600, color: theme.id === themeId ? D.text : D.sub, flex: 1 }}>{theme.name}</span>
                    {theme.id === themeId && <CheckCircle2 size={13} color={D.green} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close theme dropdown on outside click */}
      {themeDropOpen && <div onClick={() => setThemeDropOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />}

      {/* Right HUD */}
      <div style={{ position: 'absolute', top: 16, bottom: 16, right: 16, zIndex: 40, width: 'clamp(190px,16vw,250px)', display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', pointerEvents: 'auto' }}>
          <button onClick={() => setActiveModal({ type: 'pause' })}
            style={{ width: 'clamp(36px,3vw,44px)', height: 'clamp(36px,3vw,44px)', background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: D.sub }}>
            <Pause size={14} fill="currentColor" />
          </button>
        </div>

        {/* Log */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: 'auto' }}>
          {log.map(item => (
            <div key={item.id} style={{ fontSize: 'clamp(9px,0.8vw,11px)', fontFamily: 'monospace', color: D.sub, lineHeight: 1.4, borderLeft: `2px solid ${D.border}`, paddingLeft: 7, paddingTop: 2, paddingBottom: 2 }}>
              {item.msg}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* Player cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
          {players.map((p, idx) => (
            <div key={p.id}
              ref={el => cardRefs.current[idx] = el}
              onClick={() => setLedgerPlayer(p)}
              style={{
                padding: 'clamp(10px,1vw,14px) clamp(12px,1.1vw,16px)',
                borderRadius: 14, border: `1px solid ${turn === idx ? '#555' : D.border}`,
                background: turn === idx ? '#252525' : D.card,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transform: turn === idx ? 'scale(1.03)' : 'scale(1)', transition: 'all 0.2s',
                boxShadow: turn === idx ? `0 0 0 1px ${p.color}44` : 'none',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 'clamp(9px,0.8vw,12px)', height: 'clamp(9px,0.8vw,12px)', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 'clamp(11px,1vw,14px)', fontWeight: 900, textTransform: 'uppercase', color: D.text, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {p.name}{p.isPatron && <Crown size={10} color="#f1c40f" />}
                  </p>
                  <p style={{ fontSize: 'clamp(9px,0.8vw,11px)', color: D.sub, fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>{p.career}</p>
                  <p style={{ fontSize: 'clamp(9px,0.8vw,11px)', color: '#e17055', fontWeight: 700, margin: 0, fontFamily: 'monospace' }}>
                    ${p.liability.toLocaleString()} debt
                  </p>
                </div>
              </div>
              <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 'clamp(12px,1.1vw,16px)', color: p.cash > 0 ? D.green : D.red, textAlign: 'right' }}>
                ${p.cash.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Left Buttons */}
      <div style={{
        position: 'absolute', bottom: 'clamp(14px,2vh,24px)',
        left: investOpen ? 'calc(clamp(280px,22vw,340px) + clamp(12px,1.5vw,20px))' : 'clamp(14px,1.5vw,20px)',
        zIndex: 40, display: 'flex', flexDirection: 'column', gap: 10,
        width: 'clamp(120px,10vw,155px)',
        transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <button onClick={() => setInvestOpen(o => !o)}
          style={{ height: 'clamp(44px,4.5vh,56px)', background: D.card, border: `1px solid ${investOpen ? D.green : D.border}`, borderRadius: 12, fontWeight: 900, fontSize: 'clamp(10px,0.95vw,13px)', textTransform: 'uppercase', letterSpacing: '0.1em', color: investOpen ? D.green : D.blue, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <BarChart2 size="clamp(14px,1.2vw,18px)" /> Invest
        </button>
        <button
          onClick={() => { if (currentPlayer && !currentPlayer.isAI && currentPlayer.liability > 0) setRepayOpen(true); }}
          disabled={!currentPlayer || currentPlayer.isAI || currentPlayer.liability <= 0}
          style={{ height: 'clamp(44px,4.5vh,56px)', background: D.card, border: `1px solid ${!currentPlayer || currentPlayer.isAI || currentPlayer.liability <= 0 ? D.border : '#e17055'}`, borderRadius: 12, fontWeight: 900, fontSize: 'clamp(10px,0.95vw,13px)', textTransform: 'uppercase', letterSpacing: '0.1em', color: (!currentPlayer || currentPlayer.isAI || currentPlayer.liability <= 0) ? D.muted : '#e17055', cursor: (!currentPlayer || currentPlayer.isAI || currentPlayer.liability <= 0) ? 'not-allowed' : 'pointer' }}>
          Repay Debt
        </button>
        <button
          onClick={() => { if (currentPlayer && !currentPlayer.isAI && currentPlayer.cash >= 500) setSaveOpen(true); }}
          disabled={!currentPlayer || currentPlayer.isAI || currentPlayer.cash < 500}
          style={{ height: 'clamp(44px,4.5vh,56px)', background: D.card, border: `1px solid ${!currentPlayer || currentPlayer.isAI || currentPlayer.cash < 500 ? D.border : '#f39c12'}`, borderRadius: 12, fontWeight: 900, fontSize: 'clamp(10px,0.95vw,13px)', textTransform: 'uppercase', letterSpacing: '0.1em', color: (!currentPlayer || currentPlayer.isAI || currentPlayer.cash < 500) ? D.muted : '#f39c12', cursor: (!currentPlayer || currentPlayer.isAI || currentPlayer.cash < 500) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          💰 Save
        </button>
      </div>

      {/* Board */}
      <main style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px,2vw,24px)' }}>
        <div ref={boardRef} style={{
          position: 'relative', borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 0 80px rgba(0,0,0,0.9)', border: `3px solid ${activeTheme.boardBorder}`,
          background: activeTheme.board,
          width: 'min(76vh, 72vw)', height: 'min(76vh, 72vw)',
          display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gridTemplateRows: 'repeat(10,1fr)',
        }}>
          {/* Tiles */}
          {TILES.map((tile, i) => {
            const { row, col } = getTilePosition(i);
            const estState = tile.type === TILE_TYPES.ESTATE ? (estates[i] || null) : null;
            const ownerIdx = estState?.ownerId ?? null;
            const ownerColor = ownerIdx !== null ? (players[ownerIdx]?.color || '#fff') : null;
            const devIndicator = estState
              ? (estState.hasHotel ? '🏨' : '🏠'.repeat(estState.houses))
              : null;
            const { bg, text } = tileColor(tile);
            return (
              <div key={i}
                onClick={() => setTileInfoModal({ tileIdx: i })}
                style={{
                  gridArea: `${row}/${col}`,
                  background: bg, color: text,
                  border: ownerColor
                    ? `3px solid ${ownerColor}`
                    : '1px solid rgba(0,0,0,0.25)',
                  boxShadow: ownerColor ? `inset 0 0 0 2px ${ownerColor}55` : 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: 2, textAlign: 'center', overflow: 'hidden', cursor: 'pointer', position: 'relative',
                  transition: 'border 0.2s, box-shadow 0.2s',
                }}>
                {ownerColor && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: ownerColor, opacity: 0.9 }} />
                )}
                {tile.type === TILE_TYPES.PAYDAY
                  ? <span style={{ fontSize: 'clamp(12px,2.4vw,24px)', fontWeight: 900 }}>₹</span>
                  : <>
                    <span style={{ fontSize: 'clamp(4px,0.9vw,9px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1.15, wordBreak: 'break-word', padding: '0 2px' }}>{tile.name}</span>
                    {tile.sub && <span style={{ fontSize: 'clamp(3px,0.65vw,7px)', fontWeight: 700, opacity: 0.8, marginTop: 1 }}>{tile.sub}</span>}
                    {devIndicator && <span style={{ fontSize: 'clamp(5px,0.7vw,8px)', marginTop: 1, lineHeight: 1 }}>{devIndicator}</span>}
                  </>
                }
              </div>
            );
          })}

          {/* Centre */}
          <div style={{ gridColumn: '2/10', gridRow: '2/10', background: activeTheme.center, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'clamp(12px,2vh,22px)', position: 'relative' }}>
            <span style={{ position: 'absolute', fontSize: 'clamp(22px,3vw,42px)', fontWeight: 900, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.03)', textTransform: 'uppercase', pointerEvents: 'none', userSelect: 'none' }}>StraFi</span>

            <div style={{ display: 'flex', gap: 'clamp(10px,1.5vw,20px)', zIndex: 1 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ width: 'clamp(44px,5.5vw,72px)', height: 'clamp(44px,5.5vw,72px)', background: '#fff', borderRadius: 'clamp(10px,1.2vw,16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(20px,2.8vw,36px)', fontWeight: 900, color: '#111', boxShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>
                  {dice[i]}
                </div>
              ))}
            </div>

            {currentPlayer && (
              <p style={{ fontSize: 'clamp(9px,1vw,13px)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: D.sub, margin: 0, zIndex: 1 }}>
                {isAnimating ? '⟳ moving…' : `${currentPlayer.name}'s Turn`}
              </p>
            )}

            {!currentPlayer?.isAI && gameState === 'playing' && !activeModal && (
              !hasMoved
                ? <button onClick={handleRoll} disabled={isRolling || isAnimating}
                  style={{ padding: 'clamp(9px,1.1vh,15px) clamp(24px,3vw,42px)', background: (isRolling || isAnimating) ? D.muted : D.green, color: '#000', borderRadius: 50, fontWeight: 900, fontSize: 'clamp(11px,1.1vw,15px)', textTransform: 'uppercase', letterSpacing: '0.12em', border: 'none', cursor: (isRolling || isAnimating) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, zIndex: 1, boxShadow: '0 4px 20px rgba(46,204,113,0.3)' }}>
                  <Dice5 size="clamp(15px,1.4vw,20px)" /> Roll
                </button>
                : <button onClick={nextTurn} disabled={isAnimating}
                  style={{ padding: 'clamp(9px,1.1vh,15px) clamp(24px,3vw,42px)', background: isAnimating ? D.muted : D.blue, color: '#fff', borderRadius: 50, fontWeight: 900, fontSize: 'clamp(11px,1.1vw,15px)', textTransform: 'uppercase', letterSpacing: '0.12em', border: 'none', cursor: isAnimating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, zIndex: 1, boxShadow: '0 4px 20px rgba(52,152,219,0.3)' }}>
                  <CheckCircle2 size="clamp(15px,1.4vw,20px)" /> End Turn
                </button>
            )}
          </div>

          {/* Pawns */}
          {boardPx > 0 && players.map((p, idx) => {
            const dispPos = p.displayPos ?? p.position;
            const { x, y } = tilePx(dispPos, boardPx);
            const spread = (idx - (players.length - 1) / 2) * (boardPx / 10 * 0.18);
            const isActive = turn === idx;
            return (
              <div key={`pawn-${p.id}`} style={{
                position: 'absolute',
                left: x + spread, top: y + spread,
                width: 'clamp(16px,2.2vw,26px)', height: 'clamp(16px,2.2vw,26px)',
                transform: 'translate(-50%,-50%)',
                zIndex: isActive ? 60 : 50,
                transition: 'left 0.18s cubic-bezier(0.4,0,0.2,1), top 0.18s cubic-bezier(0.4,0,0.2,1)',
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  border: `2px solid rgba(255,255,255,${isActive ? 1 : 0.65})`,
                  background: p.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'clamp(5px,0.75vw,9px)', fontWeight: 900, color: '#fff',
                  boxShadow: isActive ? `0 0 14px ${p.color}, 0 2px 8px rgba(0,0,0,0.6)` : '0 2px 6px rgba(0,0,0,0.5)',
                  animation: isAnimating && isActive ? 'pawnBounce 0.18s ease' : 'none',
                }}>
                  {p.id + 1}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Ledger */}
      {ledgerPlayer && <LedgerModal player={ledgerPlayer} stocks={stocks} onClose={() => setLedgerPlayer(null)} />}

      {/* Repay Modal */}
      {repayOpen && currentPlayer && (
        <RepayModal player={currentPlayer} onRepay={handleRepay} onClose={() => setRepayOpen(false)} />
      )}

      {/* Save Modal */}
      {saveOpen && currentPlayer && (
        <SaveModal player={currentPlayer} onSave={handleSave} onClose={() => setSaveOpen(false)} />
      )}

      {/* Tile Info Modal — triggered by clicking any board tile */}
      {tileInfoModal !== null && (() => {
        const tIdx = tileInfoModal.tileIdx;
        const tile = TILES[tIdx];
        const estSt = tile.type === TILE_TYPES.ESTATE ? (estates[tIdx] || null) : null;
        const city = tile.cityIdx !== undefined ? CITY_DATA[tile.cityIdx] : null;
        const ownerP = estSt?.ownerId != null ? players[estSt.ownerId] : null;

        const TILE_DESCRIPTIONS = {
          payday: 'Payday corner — every time you pass or land here you receive your full net pay (salary + passive − expenses − tax − debt interest) automatically. No action needed.',
          opportunity: 'Fortune tile — something good happens. Draw a random card: could be a tax refund, a performance bonus, a freelance windfall, or a passive-income investment opportunity.',
          threat: 'Setback tile — an unexpected expense hits your account. The amount scales with your current salary, so higher earners feel the sting more.',
          hospital: 'Hospital tile — a random medical bill between ₹2,500–₹7,500 is immediately debited. If you cannot cover it, the shortfall is added to your outstanding debt.',
          black_swan: 'Black Swan — a rare, high-impact financial shock. Either a bank default seizes 40% of your cash, or a market crash halves your passive income. Hope you never land here.',
          career_shift: 'Career tile — your professional path shifts based on the dice roll that brought you here. A high roll earns a promotion (+₹1,000/mo salary); an odd roll means a demotion (−₹500/mo).',
          donation: 'Charity tile — donate ₹3,000 to the community fund and become a Patron, unlocking a permanent 20% bonus on every future payday.',
        };

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: 16 }} onClick={() => setTileInfoModal(null)}>
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, maxWidth: 420, width: '100%', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              {/* Color strip */}
              <div style={{ height: 4, background: tileColor(tile).bg }} />
              <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 9, color: D.sub, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 4px' }}>
                    {tile.type === TILE_TYPES.ESTATE ? 'Property' : tile.name}
                  </p>
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: D.text, margin: 0 }}>{city ? city.name : tile.name}</h3>
                </div>
                <button onClick={() => setTileInfoModal(null)} style={{ width: 30, height: 30, borderRadius: 7, background: D.panel, border: `1px solid ${D.border}`, color: D.sub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
              </div>

              <div style={{ padding: '14px 20px', overflowY: 'auto', maxHeight: '60vh' }}>
                {/* Non-estate description */}
                {tile.type !== TILE_TYPES.ESTATE && (
                  <p style={{ fontSize: 12, color: D.sub, lineHeight: 1.7, margin: '0 0 14px' }}>{TILE_DESCRIPTIONS[tile.type] || ''}</p>
                )}

                {/* Estate detail */}
                {city && (
                  <>
                    {/* Ownership status */}
                    <div style={{ background: D.panel, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${D.border}` }}>
                      <span style={{ fontSize: 11, color: D.sub }}>Status</span>
                      <span style={{ fontSize: 12, fontWeight: 900, color: ownerP ? players[estSt.ownerId]?.color || D.green : D.muted }}>
                        {ownerP ? `Owned by ${ownerP.name}` : 'Available'}
                      </span>
                    </div>

                    {/* Development */}
                    {estSt && (
                      <div style={{ background: D.panel, borderRadius: 10, padding: '10px 14px', marginBottom: 12, border: `1px solid ${D.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, color: D.sub }}>Development</span>
                          <span style={{ fontSize: 12, fontWeight: 900, color: D.text }}>
                            {estSt.hasHotel ? '🏨 Hotel' : estSt.houses > 0 ? `🏠 ${estSt.houses} House${estSt.houses > 1 ? 's' : ''}` : 'Bare Land'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 11, color: D.sub }}>Current Rent</span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: D.red, fontFamily: 'monospace' }}>₹{getEstateRent(tile.cityIdx, estSt).toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    {/* Price table */}
                    <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: D.sub, margin: '0 0 8px' }}>Rent Schedule</p>
                    <div style={{ background: D.panel, borderRadius: 10, border: `1px solid ${D.border}`, overflow: 'hidden', marginBottom: 12 }}>
                      {[
                        ['Buy Price', `₹${city.price.toLocaleString()}`, D.text],
                        ['Base Rent', `₹${city.baseRent.toLocaleString()}`, D.red],
                        ['1 House', `₹${city.houseRents[0].toLocaleString()}`, '#f39c12'],
                        ['2 Houses', `₹${city.houseRents[1].toLocaleString()}`, '#f39c12'],
                        ['3 Houses', `₹${city.houseRents[2].toLocaleString()}`, '#e74c3c'],
                        ['4 Houses', `₹${city.houseRents[3].toLocaleString()}`, '#e74c3c'],
                        ['Hotel 🏨', `₹${city.hotelRent.toLocaleString()}`, D.purple],
                      ].map(([label, value, color]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: `1px solid ${D.border}` }}>
                          <span style={{ fontSize: 11, color: D.sub }}>{label}</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Build costs */}
                    <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: D.sub, margin: '0 0 8px' }}>Build Costs</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ background: D.panel, borderRadius: 8, padding: '8px 12px', border: `1px solid ${D.border}` }}>
                        <p style={{ fontSize: 9, color: D.sub, margin: 0, textTransform: 'uppercase' }}>House 🏠</p>
                        <p style={{ fontSize: 14, fontWeight: 900, color: '#f39c12', fontFamily: 'monospace', margin: '2px 0 0' }}>₹{city.houseCost.toLocaleString()}</p>
                      </div>
                      <div style={{ background: D.panel, borderRadius: 8, padding: '8px 12px', border: `1px solid ${D.border}` }}>
                        <p style={{ fontSize: 9, color: D.sub, margin: 0, textTransform: 'uppercase' }}>Hotel 🏨</p>
                        <p style={{ fontSize: 14, fontWeight: 900, color: D.purple, fontFamily: 'monospace', margin: '2px 0 0' }}>₹{city.hotelCost.toLocaleString()}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={{ padding: '14px 20px', borderTop: `1px solid ${D.border}` }}>
                <button onClick={() => setTileInfoModal(null)} style={{ width: '100%', padding: '12px', background: '#fff', color: '#000', borderRadius: 10, fontWeight: 900, fontSize: 11, textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Estate landing modals */}
      {activeModal?.type === 'estate_unowned' && (() => {
        const city = CITY_DATA[activeModal.cityIdx];
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.78)', padding: 16 }}>
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, maxWidth: 380, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
              <div style={{ height: 3, background: city.color }} />
              <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${D.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${city.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏙️</div>
                  <div>
                    <p style={{ fontSize: 9, color: city.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Unowned Property</p>
                    <h3 style={{ fontSize: 17, fontWeight: 900, color: D.text, margin: 0 }}>{city.name}</h3>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: D.sub, margin: '0 0 12px', lineHeight: 1.5 }}>
                  This property is available. Buy it to collect rent from other players, or pay the bank ₹{activeModal.rent.toLocaleString()} to pass.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: D.panel, borderRadius: 8, padding: '9px 12px', border: `1px solid ${D.border}` }}>
                    <p style={{ fontSize: 9, color: D.sub, margin: 0, textTransform: 'uppercase' }}>Buy Price</p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: D.text, fontFamily: 'monospace', margin: '2px 0 0' }}>₹{city.price.toLocaleString()}</p>
                  </div>
                  <div style={{ background: D.panel, borderRadius: 8, padding: '9px 12px', border: `1px solid ${D.border}` }}>
                    <p style={{ fontSize: 9, color: D.sub, margin: 0, textTransform: 'uppercase' }}>Base Rent</p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: D.red, fontFamily: 'monospace', margin: '2px 0 0' }}>₹{city.baseRent.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: 18, display: 'flex', gap: 10 }}>
                <button onClick={() => handleBuyEstate(activeModal.pos, activeModal.cityIdx)}
                  style={{ flex: 1, padding: '13px', background: D.green, color: '#000', borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
                  Buy ₹{city.price.toLocaleString()}
                </button>
                <button onClick={() => handlePayBankRent(activeModal.pos, activeModal.cityIdx)}
                  style={{ flex: 1, padding: '13px', background: D.red, color: '#fff', borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
                  Pay Rent ₹{activeModal.rent.toLocaleString()}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {activeModal?.type === 'estate_own' && (() => {
        const city = CITY_DATA[activeModal.cityIdx];
        const estSt = activeModal.estState || { houses: 0, hasHotel: false };
        const curRent = getEstateRent(activeModal.cityIdx, estSt);
        const canHouse = !estSt.hasHotel && estSt.houses < 4 && currentPlayer?.cash >= city.houseCost;
        const canHotel = !estSt.hasHotel && estSt.houses === 4 && currentPlayer?.cash >= city.hotelCost;
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.78)', padding: 16 }}>
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, maxWidth: 380, width: '100%', overflow: 'hidden' }}>
              <div style={{ height: 3, background: city.color }} />
              <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${D.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${city.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏙️</div>
                  <div>
                    <p style={{ fontSize: 9, color: city.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Your Property</p>
                    <h3 style={{ fontSize: 17, fontWeight: 900, color: D.text, margin: 0 }}>{city.name}</h3>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: D.panel, borderRadius: 8, padding: '9px 12px', border: `1px solid ${D.border}` }}>
                    <p style={{ fontSize: 9, color: D.sub, margin: 0, textTransform: 'uppercase' }}>Current Rent</p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: D.green, fontFamily: 'monospace', margin: '2px 0 0' }}>₹{curRent.toLocaleString()}</p>
                  </div>
                  <div style={{ background: D.panel, borderRadius: 8, padding: '9px 12px', border: `1px solid ${D.border}` }}>
                    <p style={{ fontSize: 9, color: D.sub, margin: 0, textTransform: 'uppercase' }}>Development</p>
                    <p style={{ fontSize: 14, fontWeight: 900, color: D.text, margin: '2px 0 0' }}>
                      {estSt.hasHotel ? '🏨 Hotel' : estSt.houses > 0 ? `🏠×${estSt.houses}` : 'Bare Land'}
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!estSt.hasHotel && estSt.houses < 4 && (
                  <button onClick={() => canHouse && handleBuildOnEstate(activeModal.pos, activeModal.cityIdx, 'house')}
                    disabled={!canHouse}
                    style={{ padding: '13px', background: canHouse ? '#f39c12' : D.panel, color: canHouse ? '#000' : D.muted, borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: 'none', cursor: canHouse ? 'pointer' : 'not-allowed' }}>
                    Build House 🏠 — ₹{city.houseCost.toLocaleString()}
                  </button>
                )}
                {!estSt.hasHotel && estSt.houses === 4 && (
                  <button onClick={() => canHotel && handleBuildOnEstate(activeModal.pos, activeModal.cityIdx, 'hotel')}
                    disabled={!canHotel}
                    style={{ padding: '13px', background: canHotel ? D.purple : D.panel, color: canHotel ? '#fff' : D.muted, borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: 'none', cursor: canHotel ? 'pointer' : 'not-allowed' }}>
                    Build Hotel 🏨 — ₹{city.hotelCost.toLocaleString()}
                  </button>
                )}
                {estSt.hasHotel && (
                  <div style={{ padding: '12px', background: D.panel, borderRadius: 11, textAlign: 'center', fontSize: 12, color: D.sub }}>
                    Fully developed — collecting maximum rent 🏨
                  </div>
                )}
                <button onClick={() => setActiveModal(null)} style={{ padding: '13px', background: D.panel, color: D.sub, borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: `1px solid ${D.border}`, cursor: 'pointer' }}>
                  Skip
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modals — only for non-estate modal types */}
      {activeModal && ['card', 'donation', 'simple_info', 'pause'].includes(activeModal.type) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.78)', padding: 16 }}>
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, maxWidth: 390, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>

            {activeModal.type === 'card' && (() => {
              const isOpp = activeModal.flavor === 'opportunity';
              const accent = isOpp ? D.purple : D.red;
              const card = activeModal.card;
              return (
                <>
                  <div style={{ height: 3, background: accent }} />
                  <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${D.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 11, background: isOpp ? '#1a1028' : '#1f0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <card.Icon size={20} color={accent} />
                      </div>
                      <div>
                        <p style={{ fontSize: 9, color: accent, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>{isOpp ? 'Fortune' : 'Setback'}</p>
                        <h3 style={{ fontSize: 17, fontWeight: 900, color: D.text, margin: 0 }}>{card.title}</h3>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: D.sub, margin: 0, lineHeight: 1.5 }}>{card.msg}</p>
                  </div>
                  <div style={{ padding: 18 }}>
                    {card.cost ? (
                      <>
                        {/* Opportunity investment card — show cost and passive gain */}
                        <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: D.sub }}>Investment Cost</span>
                            <span style={{ fontSize: 14, fontWeight: 900, color: D.red, fontFamily: 'monospace' }}>−₹{card.cost.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, color: D.sub }}>Monthly Passive</span>
                            <span style={{ fontSize: 14, fontWeight: 900, color: D.green, fontFamily: 'monospace' }}>+₹{card.passive}/mo</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => processCard(turn, card)} style={{ flex: 1, padding: '13px', background: D.green, color: '#000', borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>Invest</button>
                          <button onClick={() => setActiveModal(null)} style={{ flex: 1, padding: '13px', background: D.panel, color: D.sub, borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: `1px solid ${D.border}`, cursor: 'pointer' }}>Pass</button>
                        </div>
                      </>
                    ) : card.cash ? (
                      <>
                        {/* Cash gain / loss card — show the exact amount */}
                        <div style={{ background: card.cash > 0 ? '#0d2a14' : '#2a0d0d', border: `1px solid ${card.cash > 0 ? D.green : D.red}44`, borderRadius: 10, padding: '12px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: D.sub }}>{card.cash > 0 ? 'Credited to account' : 'Debited from account'}</span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: card.cash > 0 ? D.green : D.red, fontFamily: 'monospace' }}>
                            {card.cash > 0 ? '+' : ''}₹{Math.abs(card.cash).toLocaleString()}
                          </span>
                        </div>
                        <button onClick={() => processCard(turn, card)} style={{ width: '100%', padding: '14px', background: '#fff', color: '#000', borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>Acknowledge</button>
                      </>
                    ) : (
                      <button onClick={() => processCard(turn, card)} style={{ width: '100%', padding: '14px', background: '#fff', color: '#000', borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>Acknowledge</button>
                    )}
                  </div>
                </>
              );
            })()}

            {activeModal.type === 'donation' && (
              <>
                <div style={{ padding: '26px 20px 16px', borderBottom: `1px solid ${D.border}`, textAlign: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a1230', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Heart size={26} color="#6c5ce7" fill="#6c5ce7" />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 900, color: D.text, margin: 0, textTransform: 'uppercase' }}>Philanthropy</h3>
                  <p style={{ fontSize: 12, color: D.sub, marginTop: 8, lineHeight: 1.5 }}>Donate to the community fund for <span style={{ color: '#a29bfe', fontWeight: 800 }}>+20% Payday</span>.</p>
                </div>
                <div style={{ padding: 18, display: 'flex', gap: 10 }}>
                  <button onClick={() => applyDonation(turn)} style={{ flex: 1, padding: '13px', background: '#6c5ce7', color: '#fff', borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>Donate ₹3k</button>
                  <button onClick={() => setActiveModal(null)} style={{ flex: 1, padding: '13px', background: D.panel, color: D.sub, borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: `1px solid ${D.border}`, cursor: 'pointer' }}>Skip</button>
                </div>
              </>
            )}

            {activeModal.type === 'simple_info' && (
              <>
                <div style={{ padding: '22px 20px 16px', borderBottom: `1px solid ${D.border}`, textAlign: 'center' }}>
                  <activeModal.Icon size={34} color={activeModal.iconColor} style={{ display: 'block', margin: '0 auto 10px' }} />
                  <h3 style={{ fontSize: 17, fontWeight: 900, color: D.text, margin: 0, textTransform: 'uppercase' }}>{activeModal.title}</h3>
                  <p style={{ fontSize: 12, color: D.sub, marginTop: 8, lineHeight: 1.6, marginBottom: activeModal.amountLine ? 14 : 0 }}>{activeModal.msg}</p>
                  {activeModal.amountLine && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: D.panel, border: `1px solid ${D.border}`, borderRadius: 10, padding: '10px 16px' }}>
                      <span style={{ fontSize: 11, color: D.sub, fontWeight: 700 }}>{activeModal.amountLine.label}</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color: activeModal.amountLine.color, fontFamily: 'monospace' }}>{activeModal.amountLine.value}</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: 18 }}>
                  <button onClick={() => { setActiveModal(null); if (players[turn]?.isAI) setTimeout(() => nextTurn(), 200); }} style={{ width: '100%', padding: '14px', background: '#fff', color: '#000', borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>Continue</button>
                </div>
              </>
            )}

            {activeModal.type === 'pause' && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, textTransform: 'uppercase', color: D.text, marginBottom: 24 }}>Paused</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <button onClick={() => setActiveModal(null)} style={{ padding: '14px', background: '#fff', color: '#000', borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>Resume</button>
                  <button onClick={() => window.location.reload()} style={{ padding: '14px', background: D.panel, color: D.sub, borderRadius: 11, fontWeight: 900, fontSize: 12, textTransform: 'uppercase', border: `1px solid ${D.border}`, cursor: 'pointer' }}>Exit</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Victory */}
      {gameState === 'gameover' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: D.bg, textAlign: 'center', padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3em', color: D.sub, marginBottom: 10 }}>Financial Freedom</p>
          <h1 style={{ fontSize: 'clamp(42px,8vw,80px)', fontWeight: 900, letterSpacing: '-0.04em', color: D.text, margin: 0 }}>{players[turn]?.name}</h1>
          <p style={{ fontSize: 12, color: D.sub, textTransform: 'uppercase', letterSpacing: '0.2em', margin: '10px 0 40px' }}>has transcended the rat race</p>
          <button onClick={() => window.location.reload()} style={{ padding: '16px 44px', background: '#fff', color: '#000', borderRadius: 50, fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.15em', border: 'none', cursor: 'pointer' }}>New Game</button>
        </div>
      )}
    </div>
  );
}