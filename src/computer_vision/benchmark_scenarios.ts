/**
 * Ground-Truth Benchmark Test Scenario Generator
 * Generates 8 distinct, independent CCTV environments with authentic optical
 * transformations and verification criteria for independent validation.
 */

import { AnalysisConfig, DetectionClassification, FrameAnalysisResult } from '../types';

export interface BenchmarkFrameData {
  frameNumber: number;
  timestampSeconds: number;
  dataUrl: string;
  title: string;
  expectedClassification: DetectionClassification;
}

export interface BenchmarkScenarioData {
  referenceDataUrl: string;
  width: number;
  height: number;
  currentDataUrl?: string; // for single-frame tests
  frames?: BenchmarkFrameData[]; // for multi-frame tests
}

export interface BenchmarkTestCase {
  id: string;
  testNumber: number;
  name: string;
  facility: string;
  description: string;
  expectedClassification: DetectionClassification;
  isMultiFrame?: boolean;
  generateScenario: () => BenchmarkScenarioData;
  verifyResult: (
    actualResult: FrameAnalysisResult | FrameAnalysisResult[],
    config: AnalysisConfig,
    injectedError?: boolean
  ) => { passed: boolean; failureReason?: string };
}

// Canvas dimensions for standardized benchmark scenes
const SCENE_W = 640;
const SCENE_H = 400;

// --- 8 DISTINCT PROCEDURAL CCTV SCENE RENDERERS ---

/**
 * Scene 1: Data Center Server Room
 * High-density server rack cabinets with blinking LEDs, vertical mesh slots,
 * overhead cable ladders, and raised floor tiles.
 */
function drawServerRoomScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Deep dark room with server blue ambiance
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, w, h);

  // Overhead cable tray & ceiling rafters
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, w, 70);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  for (let x = 20; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 70);
    ctx.stroke();
    ctx.strokeRect(x - 5, 20, 30, 20);
  }

  // Raised floor tiles with perspective
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, h - 110, w, 110);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  for (let x = -40; x < w + 60; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, h - 110);
    ctx.lineTo(x * 1.3 - 80, h);
    ctx.stroke();
  }
  for (let y = h - 110; y < h; y += 25) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Server Racks Left & Right
  const drawRack = (rx: number, ry: number, rw: number, rh: number) => {
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);

    // Chassis units (1U / 2U slots)
    for (let u = ry + 8; u < ry + rh - 10; u += 18) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(rx + 4, u, rw - 8, 14);
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(rx + 4, u, rw - 8, 14);

      // Blinking status LEDs (green, amber, cyan)
      const colors = ['#22c55e', '#10b981', '#06b6d4', '#eab308', '#ef4444'];
      for (let l = 0; l < 4; l++) {
        ctx.fillStyle = colors[(u + l) % colors.length];
        ctx.fillRect(rx + 8 + l * 12, u + 4, 6, 6);
      }

      // Ventilation grid slits
      ctx.fillStyle = '#0f172a';
      for (let s = rx + 65; s < rx + rw - 10; s += 8) {
        ctx.fillRect(s, u + 3, 4, 8);
      }
    }
  };

  drawRack(40, 70, 140, 220);
  drawRack(210, 70, 140, 220);
  drawRack(380, 70, 140, 220);

  // Digital Environmental Monitor Panel on Right Wall
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(540, 110, 85, 120);
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.strokeRect(540, 110, 85, 120);
  ctx.fillStyle = '#0284c7';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('TEMP: 19.4C', 545, 135);
  ctx.fillText('HUM:  42%', 545, 155);
  ctx.fillText('PDU:  NOMINAL', 545, 175);
}

/**
 * Scene 2: Commercial Bank Vault & Safe Deposit
 * Heavy circular steel vault door with spoke wheel, locking bolts, safety deposit boxes,
 * digital pinpad, and granite tiled floor.
 */
function drawBankVaultScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Granite wall background
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, w, h);

  // Polished stone floor
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, h - 90, w, 90);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 65) {
    ctx.beginPath();
    ctx.moveTo(x, h - 90);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // Safety deposit box grid on left
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(30, 60, 160, 230);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  for (let row = 65; row < 285; row += 22) {
    for (let col = 35; col < 185; col += 36) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(col, row, 32, 18);
      ctx.strokeRect(col, row, 32, 18);
      // Keyholes
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(col + 14, row + 7, 4, 4);
    }
  }

  // Massive circular vault door in center
  const vcx = 360;
  const vcy = 180;
  const vr = 110;

  // Outer steel door frame
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(vcx, vcy, vr + 15, 0, Math.PI * 2);
  ctx.fill();

  // Polished chrome door body
  const grad = ctx.createRadialGradient(vcx - 30, vcy - 30, 20, vcx, vcy, vr);
  grad.addColorStop(0, '#f8fafc');
  grad.addColorStop(0.5, '#94a3b8');
  grad.addColorStop(1, '#475569');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(vcx, vcy, vr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Radial locking bolts around perimeter
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    const bx = vcx + Math.cos(a) * (vr - 12);
    const by = vcy + Math.sin(a) * (vr - 12);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Central spoke handwheel
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(vcx, vcy, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 5;
  for (let s = 0; s < 4; s++) {
    const sa = (s * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(vcx - Math.cos(sa) * 55, vcy - Math.sin(sa) * 55);
    ctx.lineTo(vcx + Math.cos(sa) * 55, vcy + Math.sin(sa) * 55);
    ctx.stroke();
  }

  // Security Keypad on right wall
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(520, 130, 80, 130);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2;
  ctx.strokeRect(520, 130, 80, 130);
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('ARMED', 542, 150);
  // Keypad buttons
  for (let kr = 0; kr < 4; kr++) {
    for (let kc = 0; kc < 3; kc++) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(528 + kc * 18, 160 + kr * 22, 14, 16);
    }
  }
}

/**
 * Scene 3: Logistics Distribution Warehouse
 * High-bay steel pallet racking, wooden pallets with labelled boxes,
 * yellow/black hazard diagonal floor tape, and roll-up shutter bay door.
 */
function drawWarehouseScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Industrial concrete background
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, w, h);

  // Epoxy warehouse floor with safety markings
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, h - 120, w, 120);

  // Yellow and black hazard diagonal warning stripe zone
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, h - 120, w, 24);
  ctx.clip();
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, h - 120, w, 24);
  ctx.fillStyle = '#0f172a';
  for (let x = -50; x < w + 50; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, h - 120);
    ctx.lineTo(x + 15, h - 120);
    ctx.lineTo(x - 5, h - 96);
    ctx.lineTo(x - 20, h - 96);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Roll-up industrial shutter door in center
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(40, 40, 220, 240);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  for (let s = 45; s < 280; s += 16) {
    ctx.strokeRect(42, s, 216, 12);
  }
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('BAY 04 - LOADING DOCK', 60, 25);

  // Heavy duty pallet racks on right
  ctx.fillStyle = '#eab308'; // Bright yellow steel uprights
  ctx.fillRect(310, 40, 16, 240);
  ctx.fillRect(450, 40, 16, 240);
  ctx.fillRect(590, 40, 16, 240);

  // Rack shelf beams
  const shelfY = [90, 160, 230];
  shelfY.forEach((sy) => {
    ctx.fillStyle = '#eab308';
    ctx.fillRect(310, sy, 296, 10);

    // Pallets & boxes on shelves
    ctx.fillStyle = '#b45309'; // Wooden pallet
    ctx.fillRect(330, sy - 8, 110, 8);
    ctx.fillRect(470, sy - 8, 110, 8);

    // Shipping cardboard boxes with barcodes
    ctx.fillStyle = '#d97706';
    ctx.fillRect(340, sy - 52, 90, 44);
    ctx.fillRect(480, sy - 58, 90, 50);
    // Box barcode labels
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(350, sy - 35, 30, 18);
    ctx.fillRect(495, sy - 40, 35, 20);
    ctx.fillStyle = '#0f172a';
    for (let b = 0; b < 5; b++) {
      ctx.fillRect(353 + b * 5, sy - 32, 2, 12);
      ctx.fillRect(498 + b * 6, sy - 37, 2, 14);
    }
  });
}

/**
 * Scene 4: University Lecture Hall / Examination Room
 * Tiered desks with seat numbers, chalkboard with formulas,
 * analog wall clock, projection screen, and teacher podium.
 */
function drawLectureHallScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Classroom wall
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, w, h);

  // Large green chalkboard
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(60, 40, 380, 160);
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 6;
  ctx.strokeRect(60, 40, 380, 160);

  // Chalk formulas & diagrams on board
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 2;
  // Coordinate axes
  ctx.beginPath();
  ctx.moveTo(90, 170);
  ctx.lineTo(200, 170);
  ctx.moveTo(90, 170);
  ctx.lineTo(90, 80);
  ctx.stroke();
  // Parabola curve
  ctx.beginPath();
  for (let x = 90; x <= 180; x += 5) {
    const y = 170 - 0.015 * Math.pow(x - 135, 2);
    if (x === 90) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 12px serif';
  ctx.fillText('f(x) = ax^2 + bx + c', 100, 75);
  ctx.fillText('det(H) = h11*h22 - h12*h21', 220, 100);
  ctx.fillText('RANSAC Consensus: S > 0.85', 220, 130);

  // Classroom Wall Clock
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(495, 75, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.stroke();
  // Clock hands (showing 10:10)
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(495, 75);
  ctx.lineTo(485, 60);
  ctx.moveTo(495, 75);
  ctx.lineTo(512, 65);
  ctx.stroke();

  // Tiered examination desks
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, 220, w, 180);

  const deskRows = [
    { y: 240, h: 40, desks: 4 },
    { y: 295, h: 45, desks: 5 },
    { y: 350, h: 50, desks: 5 },
  ];

  deskRows.forEach((row, ri) => {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, row.y + row.h - 8, w, 8);
    const deskWidth = w / row.desks - 20;

    for (let d = 0; d < row.desks; d++) {
      const dx = 15 + d * (deskWidth + 15);
      ctx.fillStyle = '#b45309'; // Wood desk top
      ctx.fillRect(dx, row.y, deskWidth, row.h - 12);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.strokeRect(dx, row.y, deskWidth, row.h - 12);

      // Student exam placard
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx + 10, row.y + 6, 26, 16);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`D${ri}${d}`, dx + 13, row.y + 18);
    }
  });
}

/**
 * Scene 5: Pharmaceutical Chemistry Cleanroom
 * Stainless steel laminar flow hood, chemical reagent racks, safety hazard diamond,
 * glassware flasks, and sterile white epoxy floor.
 */
function drawChemistryLabScene(ctx: CanvasRenderingContext2D, w: number, h: number, dimmed: boolean = false) {
  // Sterile white/cyan cleanroom walls
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(0, 0, w, h);

  // Seamless epoxy floor
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, h - 110, w, 110);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, h - 110);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // Fume Hood on left
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(50, 40, 260, 250);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(60, 60, 240, 160); // Glass sash window
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.strokeRect(60, 60, 240, 160);

  // Glassware flasks inside fume hood
  const drawFlask = (fx: number, fy: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(fx - 15, fy + 30);
    ctx.lineTo(fx + 15, fy + 30);
    ctx.lineTo(fx + 5, fy);
    ctx.lineTo(fx - 5, fy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  drawFlask(100, 140, '#a855f7');
  drawFlask(160, 140, '#22c55e');
  drawFlask(220, 140, '#f97316');

  // Emergency Safety Eye-Wash Station on right
  ctx.fillStyle = '#16a34a'; // Safety green
  ctx.fillRect(360, 50, 120, 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('SAFETY SHOWER', 368, 75);
  ctx.fillText('& EYE WASH', 380, 95);

  // NFPA 704 Hazard Diamond Placard
  const hx = 540;
  const hy = 110;
  const s = 24;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#3b82f6'; // Health Blue
  ctx.fillRect(-s, -s, s, s);
  ctx.fillStyle = '#ef4444'; // Flammability Red
  ctx.fillRect(0, -s, s, s);
  ctx.fillStyle = '#eab308'; // Instability Yellow
  ctx.fillRect(-s, 0, s, s);
  ctx.fillStyle = '#f8fafc'; // Special White
  ctx.fillRect(0, 0, s, s);
  ctx.restore();

  // Dim illumination if test requires lighting drop
  if (dimmed) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.48)';
    ctx.fillRect(0, 0, w, h);
  }
}

/**
 * Scene 6: Hospital Intensive Care Bay
 * Patient monitor screen with ECG trace, hospital bed frame,
 * IV infusion stands, and medical gas supply panel.
 */
function drawHospitalIcuScene(ctx: CanvasRenderingContext2D, w: number, h: number, occluded: boolean = false) {
  // Hospital pale teal wall
  ctx.fillStyle = '#ccfbf1';
  ctx.fillRect(0, 0, w, h);

  // Hospital floor
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, h - 100, w, 100);

  // Medical Gas Outlets on wall (O2, Vacuum, Air)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(60, 40, 140, 60);
  const gasColors = ['#22c55e', '#eab308', '#3b82f6'];
  for (let g = 0; g < 3; g++) {
    ctx.fillStyle = gasColors[g];
    ctx.beginPath();
    ctx.arc(85 + g * 45, 70, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(82 + g * 45, 67, 6, 6);
  }

  // Patient Bed frame
  ctx.fillStyle = '#334155';
  ctx.fillRect(180, 190, 260, 110);
  ctx.fillStyle = '#f8fafc'; // White mattress/linens
  ctx.fillRect(190, 175, 240, 40);
  // Bed headboard and rails
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(180, 150, 16, 150);
  ctx.strokeRect(424, 170, 16, 130);

  // Vital Signs Monitor Cart on right
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(480, 90, 120, 180);
  ctx.fillStyle = '#022c22';
  ctx.fillRect(490, 100, 100, 90); // Green CRT monitor screen
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  // ECG Rhythm Waveform
  ctx.beginPath();
  let ecgX = 495;
  const ecgY = 145;
  ctx.moveTo(ecgX, ecgY);
  while (ecgX < 585) {
    ctx.lineTo(ecgX + 8, ecgY);
    ctx.lineTo(ecgX + 11, ecgY - 18); // R spike
    ctx.lineTo(ecgX + 14, ecgY + 8); // S wave
    ctx.lineTo(ecgX + 17, ecgY);
    ctx.lineTo(ecgX + 28, ecgY);
    ecgX += 28;
  }
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('HR: 72 BPM', 495, 120);
  ctx.fillText('SpO2: 98%', 495, 178);

  // If occluded: large mobile lead protective shield / emergency partition obscuring >75% of field
  if (occluded) {
    ctx.fillStyle = '#78350f'; // Heavy mobile partition
    ctx.fillRect(90, 50, 470, 290);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 6;
    ctx.strokeRect(90, 50, 470, 290);

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('MOBILE QUARANTINE BARRIER', 140, 170);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.fillText('Critical optical landmarks obstructed (75% FOV loss)', 145, 210);
  }
}

/**
 * Scene 7: Defocused / Fogged Surface (Insufficient Features)
 * Flat uniform color with zero sharp corners or high-contrast texture.
 */
function drawInsufficientFeaturesScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Perfectly smooth uniform gray wall
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, w, h);
  // Extremely soft, featureless gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Scene 8: Airport Security Gate Checkpoint
 * Walkthrough metal detector archway, baggage X-ray inspection conveyor,
 * queue stanchion poles, and security directional floor tape.
 */
function drawAirportSecurityScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Terminal hall background
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, w, h);

  // Terminal terrazzo floor
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, h - 110, w, 110);

  // Walk-through metal detector portal (left-center)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(100, 50, 26, 240); // Left pillar
  ctx.fillRect(230, 50, 26, 240); // Right pillar
  ctx.fillRect(100, 50, 156, 30); // Top lintel
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.strokeRect(100, 50, 156, 240);
  // Green entry LEDs
  ctx.fillStyle = '#22c55e';
  for (let y = 90; y < 270; y += 25) {
    ctx.fillRect(108, y, 10, 10);
    ctx.fillRect(238, y, 10, 10);
  }

  // Baggage X-ray Conveyor on right
  ctx.fillStyle = '#334155';
  ctx.fillRect(320, 120, 260, 100);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(370, 70, 160, 150); // Lead tunnel
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 3;
  ctx.strokeRect(370, 70, 160, 150);

  // Conveyor rollers
  ctx.fillStyle = '#94a3b8';
  for (let rx = 330; rx < 570; rx += 20) {
    ctx.fillRect(rx, 160, 12, 50);
  }

  // Directional security signs
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(130, 20, 200, 25);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('INTERNATIONAL SECURITY CHECKPOINT', 135, 37);
}

// Helper to render a scenario pair with optional transform
function createSinglePairScenario(
  drawRef: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  drawCurr: (
    ctx: CanvasRenderingContext2D,
    refCanvas: HTMLCanvasElement,
    w: number,
    h: number
  ) => void
): BenchmarkScenarioData {
  const refCanvas = document.createElement('canvas');
  refCanvas.width = SCENE_W;
  refCanvas.height = SCENE_H;
  const refCtx = refCanvas.getContext('2d', { willReadFrequently: true })!;
  drawRef(refCtx, SCENE_W, SCENE_H);

  const currCanvas = document.createElement('canvas');
  currCanvas.width = SCENE_W;
  currCanvas.height = SCENE_H;
  const currCtx = currCanvas.getContext('2d', { willReadFrequently: true })!;
  drawCurr(currCtx, refCanvas, SCENE_W, SCENE_H);

  return {
    referenceDataUrl: refCanvas.toDataURL('image/jpeg', 0.95),
    currentDataUrl: currCanvas.toDataURL('image/jpeg', 0.95),
    width: SCENE_W,
    height: SCENE_H,
  };
}

// --- THE 8 INDEPENDENT COMPUTER VISION VERIFICATION TESTS ---

export const BENCHMARK_TEST_SUITE: BenchmarkTestCase[] = [
  // TEST 1: Original Reference View
  {
    id: 'test_1_normal',
    testNumber: 1,
    name: 'Original Reference View',
    facility: 'Data Center Server Room (Cam 01)',
    description:
      'Reference baseline and incoming frame share the identical camera viewpoint under nominal operating conditions. Expected: No movement alert (Camera Status: Stable).',
    expectedClassification: 'NORMAL VIEW',
    generateScenario: () => {
      return createSinglePairScenario(
        (ctx, w, h) => drawServerRoomScene(ctx, w, h),
        (ctx, ref) => {
          ctx.drawImage(ref, 0, 0);
        }
      );
    },
    verifyResult: (actualResult, config, injectedError) => {
      const res = Array.isArray(actualResult) ? actualResult[0] : actualResult;
      if (injectedError) {
        return {
          passed: false,
          failureReason: `Deliberate Error Injected: Simulated expectation mismatch (expected "ROTATION DETECTED", but algorithm detected "${res.classification}").`,
        };
      }

      if (res.classification !== 'NORMAL VIEW') {
        return {
          passed: false,
          failureReason: `Expected "NORMAL VIEW" (Stable), but detected "${res.classification}". Shift was ${res.transformation.translationDistance}px, rotation was ${res.transformation.rotationDegrees}°.`,
        };
      }

      if (res.transformation.translationDistance > config.translationThresholdPx) {
        return {
          passed: false,
          failureReason: `Displacement of ${res.transformation.translationDistance}px exceeded nominal tolerance of ${config.translationThresholdPx}px.`,
        };
      }

      if (Math.abs(res.transformation.rotationDegrees) > config.rotationThresholdDeg) {
        return {
          passed: false,
          failureReason: `Rotation of ${res.transformation.rotationDegrees}° exceeded nominal tolerance of ${config.rotationThresholdDeg}°.`,
        };
      }

      return { passed: true };
    },
  },

  // TEST 2: Camera Shift
  {
    id: 'test_2_shift',
    testNumber: 2,
    name: 'Camera Shift',
    facility: 'Logistics Distribution Warehouse (Cam 02)',
    description:
      'Camera mount undergoes physical translation (+38px horizontal, -18px vertical). Expected: Shift detected (Camera Status: Shift Detected).',
    expectedClassification: 'VIEWPOINT SHIFT DETECTED',
    generateScenario: () => {
      return createSinglePairScenario(
        (ctx, w, h) => drawWarehouseScene(ctx, w, h),
        (ctx, ref) => {
          ctx.drawImage(ref, 38, -18);
        }
      );
    },
    verifyResult: (actualResult, config, injectedError) => {
      const res = Array.isArray(actualResult) ? actualResult[0] : actualResult;
      if (injectedError) {
        return {
          passed: false,
          failureReason: `Deliberate Error Injected: Simulated tolerance failure (expected "NORMAL VIEW", but algorithm detected "${res.classification}").`,
        };
      }

      if (res.classification !== 'VIEWPOINT SHIFT DETECTED') {
        return {
          passed: false,
          failureReason: `Expected "VIEWPOINT SHIFT DETECTED" (Shift Detected), but detected "${res.classification}". Shift distance was ${res.transformation.translationDistance}px (threshold: ${config.translationThresholdPx}px).`,
        };
      }

      if (res.transformation.translationDistance < config.translationThresholdPx) {
        return {
          passed: false,
          failureReason: `Measured translation (${res.transformation.translationDistance}px) was below detection threshold (${config.translationThresholdPx}px).`,
        };
      }

      return { passed: true };
    },
  },

  // TEST 3: Camera Rotation
  {
    id: 'test_3_rotation',
    testNumber: 3,
    name: 'Camera Rotation',
    facility: 'Commercial Bank Vault (Cam 03)',
    description:
      'Physical camera mounting body is rotated by +5.0 degrees around the optical center. Expected: Rotation detected (Camera Status: Rotation Detected).',
    expectedClassification: 'ROTATION DETECTED',
    generateScenario: () => {
      return createSinglePairScenario(
        (ctx, w, h) => drawBankVaultScene(ctx, w, h),
        (ctx, ref, w, h) => {
          ctx.translate(w / 2, h / 2);
          ctx.rotate((5.0 * Math.PI) / 180);
          ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(ref, 0, 0);
        }
      );
    },
    verifyResult: (actualResult, config, injectedError) => {
      const res = Array.isArray(actualResult) ? actualResult[0] : actualResult;
      if (injectedError) {
        return {
          passed: false,
          failureReason: `Deliberate Error Injected: Simulated threshold violation (expected "NORMAL VIEW", but algorithm detected "${res.classification}").`,
        };
      }

      if (res.classification !== 'ROTATION DETECTED') {
        return {
          passed: false,
          failureReason: `Expected "ROTATION DETECTED" (Rotation Detected), but detected "${res.classification}". Detected rotation was ${res.transformation.rotationDegrees}° (threshold: ${config.rotationThresholdDeg}°).`,
        };
      }

      if (Math.abs(res.transformation.rotationDegrees) < config.rotationThresholdDeg) {
        return {
          passed: false,
          failureReason: `Measured rotation (${res.transformation.rotationDegrees}°) did not reach required threshold (${config.rotationThresholdDeg}°).`,
        };
      }

      return { passed: true };
    },
  },

  // TEST 4: Minor Lighting Variation
  {
    id: 'test_4_lighting',
    testNumber: 4,
    name: 'Minor Lighting Variation',
    facility: 'Pharmaceutical Research Cleanroom (Cam 04)',
    description:
      'Room lighting drops by 45% (photometric shift), while physical camera position is motionless. Expected: No false movement alert (Camera Status: Stable).',
    expectedClassification: 'LIGHTING VARIATION',
    generateScenario: () => {
      return createSinglePairScenario(
        (ctx, w, h) => drawChemistryLabScene(ctx, w, h, false),
        (ctx, _, w, h) => {
          drawChemistryLabScene(ctx, w, h, true);
        }
      );
    },
    verifyResult: (actualResult, config, injectedError) => {
      const res = Array.isArray(actualResult) ? actualResult[0] : actualResult;
      if (injectedError) {
        return {
          passed: false,
          failureReason: `Deliberate Error Injected: Injected false camera shift into lighting test.`,
        };
      }

      if (res.classification !== 'LIGHTING VARIATION') {
        return {
          passed: false,
          failureReason: `Expected "LIGHTING VARIATION" (Stable), but detected "${res.classification}". Luminance delta was ${res.luminanceDelta} (threshold: ${config.brightnessTolerancePercent}%).`,
        };
      }

      if (res.transformation.translationDistance > config.translationThresholdPx) {
        return {
          passed: false,
          failureReason: `False camera movement reported during lighting change (${res.transformation.translationDistance}px shift).`,
        };
      }

      if (Math.abs(res.transformation.rotationDegrees) > config.rotationThresholdDeg) {
        return {
          passed: false,
          failureReason: `False camera rotation reported during lighting change (${res.transformation.rotationDegrees}°).`,
        };
      }

      return { passed: true };
    },
  },

  // TEST 5: Camera Movement with Lighting Variation
  {
    id: 'test_5_movement_with_lighting',
    testNumber: 5,
    name: 'Camera Movement with Lighting Variation',
    facility: 'Automated Microelectronics Cleanroom (Cam 05)',
    description:
      'Camera mount undergoes physical translation (+32px horizontal, -15px vertical) simultaneously with a 38% drop in ambient illumination. Expected: Correctly detect camera movement (Camera Status: Shift Detected).',
    expectedClassification: 'VIEWPOINT SHIFT DETECTED',
    generateScenario: () => {
      return createSinglePairScenario(
        (ctx, w, h) => drawChemistryLabScene(ctx, w, h, false),
        (ctx, ref, w, h) => {
          ctx.drawImage(ref, 32, -15);
          ctx.fillStyle = 'rgba(10, 15, 30, 0.42)';
          ctx.fillRect(0, 0, w, h);
        }
      );
    },
    verifyResult: (actualResult, config, injectedError) => {
      const res = Array.isArray(actualResult) ? actualResult[0] : actualResult;
      if (injectedError) {
        return {
          passed: false,
          failureReason: `Deliberate Error Injected: Simulated missed motion during illumination drop (expected "LIGHTING VARIATION", but algorithm detected "${res.classification}").`,
        };
      }

      if (res.classification !== 'VIEWPOINT SHIFT DETECTED') {
        return {
          passed: false,
          failureReason: `Expected "VIEWPOINT SHIFT DETECTED" (Shift Detected), but detected "${res.classification}". Camera movement must be detected despite lighting changes. Shift was ${res.transformation.translationDistance}px (threshold: ${config.translationThresholdPx}px).`,
        };
      }

      if (res.transformation.translationDistance < config.translationThresholdPx) {
        return {
          passed: false,
          failureReason: `Measured translation (${res.transformation.translationDistance}px) was below detection threshold (${config.translationThresholdPx}px).`,
        };
      }

      return { passed: true };
    },
  },

  // TEST 6: Zoom Change
  {
    id: 'test_6_zoom',
    testNumber: 6,
    name: 'Zoom Change',
    facility: 'University Examination Hall (Cam 06)',
    description:
      'Focal length increases by 18% (scale factor 1.18x) around optical center. Pass only when actual zoom expansion is identified without false translation.',
    expectedClassification: 'ZOOM CHANGE DETECTED',
    generateScenario: () => {
      return createSinglePairScenario(
        (ctx, w, h) => drawLectureHallScene(ctx, w, h),
        (ctx, ref, w, h) => {
          const scale = 1.18;
          ctx.translate(w / 2, h / 2);
          ctx.scale(scale, scale);
          ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(ref, 0, 0);
        }
      );
    },
    verifyResult: (actualResult, config, injectedError) => {
      const res = Array.isArray(actualResult) ? actualResult[0] : actualResult;
      if (injectedError) {
        return {
          passed: false,
          failureReason: `Deliberate Error Injected: Simulated zoom mismatch (expected "NORMAL VIEW", but algorithm detected "${res.classification}").`,
        };
      }

      if (res.classification !== 'ZOOM CHANGE DETECTED') {
        return {
          passed: false,
          failureReason: `Expected "ZOOM CHANGE DETECTED", but detected "${res.classification}". Scale factor was ${(res.transformation.scaleChange * 100).toFixed(1)}%.`,
        };
      }

      const zoomDeviationPct = Math.abs(res.transformation.scaleChange - 1.0) * 100;
      if (zoomDeviationPct < config.zoomThresholdPercent) {
        return {
          passed: false,
          failureReason: `Measured scale change (${zoomDeviationPct.toFixed(1)}%) was below zoom threshold (${config.zoomThresholdPercent}%).`,
        };
      }

      return { passed: true };
    },
  },

  // TEST 7: Unexpected Scene Change
  {
    id: 'test_7_scene_change',
    testNumber: 7,
    name: 'Unexpected Scene Change',
    facility: 'Hospital Intensive Care Bay (Cam 07)',
    description:
      'A large mobile lead partition blocks >75% of the optical field of view. Pass only when landmark retention collapse and scene discrepancy are correctly identified.',
    expectedClassification: 'SCENE CHANGE DETECTED',
    generateScenario: () => {
      return createSinglePairScenario(
        (ctx, w, h) => drawHospitalIcuScene(ctx, w, h, false),
        (ctx, _, w, h) => {
          drawHospitalIcuScene(ctx, w, h, true);
        }
      );
    },
    verifyResult: (actualResult, config, injectedError) => {
      const res = Array.isArray(actualResult) ? actualResult[0] : actualResult;
      if (injectedError) {
        return {
          passed: false,
          failureReason: `Deliberate Error Injected: Simulated occlusion acceptance (expected "NORMAL VIEW", but algorithm detected "${res.classification}").`,
        };
      }

      if (res.classification !== 'SCENE CHANGE DETECTED') {
        return {
          passed: false,
          failureReason: `Expected "SCENE CHANGE DETECTED", but detected "${res.classification}". Consistency score was ${res.sceneConsistencyScore}%.`,
        };
      }

      return { passed: true };
    },
  },

  // TEST 8: Insufficient Visual Features
  {
    id: 'test_8_insufficient_features',
    testNumber: 8,
    name: 'Insufficient Visual Features',
    facility: 'Defocused / Fogged Lens Surface (Cam 08)',
    description:
      'Camera pointed at an underexposed, featureless blank surface. Pass only when system reports insufficient visual features instead of phantom motion.',
    expectedClassification: 'INSUFFICIENT FEATURES',
    generateScenario: () => {
      return createSinglePairScenario(
        (ctx, w, h) => drawInsufficientFeaturesScene(ctx, w, h),
        (ctx, _, w, h) => {
          drawInsufficientFeaturesScene(ctx, w, h);
        }
      );
    },
    verifyResult: (actualResult, config, injectedError) => {
      const res = Array.isArray(actualResult) ? actualResult[0] : actualResult;
      if (injectedError) {
        return {
          passed: false,
          failureReason: `Deliberate Error Injected: Simulated false feature detection.`,
        };
      }

      if (res.classification !== 'INSUFFICIENT FEATURES') {
        return {
          passed: false,
          failureReason: `Expected "INSUFFICIENT FEATURES", but detected "${res.classification}". Features detected was ${res.featuresDetected} (required: ${config.minKeypointsRequired}).`,
        };
      }

      if (res.featuresDetected >= config.minKeypointsRequired) {
        return {
          passed: false,
          failureReason: `Detected ${res.featuresDetected} keypoints, which exceeds minimum threshold of ${config.minKeypointsRequired}.`,
        };
      }

      return { passed: true };
    },
  },

  // TEST 9: Chronological Multi-Frame Sequence
  {
    id: 'test_9_multi_frames',
    testNumber: 9,
    name: 'Chronological Multi-Frame Sequence',
    facility: 'Airport Security Checkpoint (Cam 09)',
    description:
      'Evaluates 4 sequential chronological frames (t=0.0s, 0.5s, 1.0s, 1.5s). Validates sequential frame processing, timestamps, and viewpoint-change confirmation.',
    expectedClassification: 'VIEWPOINT SHIFT DETECTED',
    isMultiFrame: true,
    generateScenario: () => {
      // 1. Reference Scene
      const refCanvas = document.createElement('canvas');
      refCanvas.width = SCENE_W;
      refCanvas.height = SCENE_H;
      const refCtx = refCanvas.getContext('2d', { willReadFrequently: true })!;
      drawAirportSecurityScene(refCtx, SCENE_W, SCENE_H);
      const referenceDataUrl = refCanvas.toDataURL('image/jpeg', 0.95);

      // 2. Sequential Chronological Frames
      const frames: BenchmarkFrameData[] = [];

      // Frame 1 (t = 0.0s): Nominal baseline
      const f1Canvas = document.createElement('canvas');
      f1Canvas.width = SCENE_W;
      f1Canvas.height = SCENE_H;
      const f1Ctx = f1Canvas.getContext('2d', { willReadFrequently: true })!;
      f1Ctx.drawImage(refCanvas, 0, 0);
      frames.push({
        frameNumber: 1,
        timestampSeconds: 0.0,
        dataUrl: f1Canvas.toDataURL('image/jpeg', 0.92),
        title: 'Frame 1 (0.0s) - Nominal Baseline',
        expectedClassification: 'NORMAL VIEW',
      });

      // Frame 2 (t = 0.5s): Nominal baseline
      const f2Canvas = document.createElement('canvas');
      f2Canvas.width = SCENE_W;
      f2Canvas.height = SCENE_H;
      const f2Ctx = f2Canvas.getContext('2d', { willReadFrequently: true })!;
      f2Ctx.drawImage(refCanvas, 0, 0);
      frames.push({
        frameNumber: 2,
        timestampSeconds: 0.5,
        dataUrl: f2Canvas.toDataURL('image/jpeg', 0.92),
        title: 'Frame 2 (0.5s) - Nominal Baseline',
        expectedClassification: 'NORMAL VIEW',
      });

      // Frame 3 (t = 1.0s): Sudden physical shift (+36px, -16px)
      const f3Canvas = document.createElement('canvas');
      f3Canvas.width = SCENE_W;
      f3Canvas.height = SCENE_H;
      const f3Ctx = f3Canvas.getContext('2d', { willReadFrequently: true })!;
      f3Ctx.drawImage(refCanvas, 36, -16);
      frames.push({
        frameNumber: 3,
        timestampSeconds: 1.0,
        dataUrl: f3Canvas.toDataURL('image/jpeg', 0.92),
        title: 'Frame 3 (1.0s) - Sudden Viewpoint Shift',
        expectedClassification: 'VIEWPOINT SHIFT DETECTED',
      });

      // Frame 4 (t = 1.5s): Sustained physical shift (+36px, -16px) -> Triggers consecutive event confirmation
      const f4Canvas = document.createElement('canvas');
      f4Canvas.width = SCENE_W;
      f4Canvas.height = SCENE_H;
      const f4Ctx = f4Canvas.getContext('2d', { willReadFrequently: true })!;
      f4Ctx.drawImage(refCanvas, 36, -16);
      frames.push({
        frameNumber: 4,
        timestampSeconds: 1.5,
        dataUrl: f4Canvas.toDataURL('image/jpeg', 0.92),
        title: 'Frame 4 (1.5s) - Sustained Confirmed Viewpoint Shift',
        expectedClassification: 'VIEWPOINT SHIFT DETECTED',
      });

      return {
        referenceDataUrl,
        width: SCENE_W,
        height: SCENE_H,
        currentDataUrl: frames[frames.length - 1].dataUrl,
        frames,
      };
    },
    verifyResult: (actualResult, config, injectedError) => {
      const resultsArray = Array.isArray(actualResult) ? actualResult : [actualResult];
      if (injectedError) {
        return {
          passed: false,
          failureReason: `Deliberate Error Injected: Multi-frame sequence chronological timestamp check failed.`,
        };
      }

      if (resultsArray.length < 4) {
        return {
          passed: false,
          failureReason: `Expected 4 sequential chronological frames, but processed only ${resultsArray.length}.`,
        };
      }

      // 1. Chronological order check
      for (let i = 1; i < resultsArray.length; i++) {
        if (resultsArray[i].timestampSeconds <= resultsArray[i - 1].timestampSeconds) {
          return {
            passed: false,
            failureReason: `Chronological violation: Frame #${resultsArray[i].frameNumber} (${resultsArray[i].timestampSeconds}s) is not strictly after Frame #${resultsArray[i - 1].frameNumber} (${resultsArray[i - 1].timestampSeconds}s).`,
          };
        }
      }

      // 2. Initial nominal frames check
      if (resultsArray[0].classification !== 'NORMAL VIEW') {
        return {
          passed: false,
          failureReason: `Frame #1 expected "NORMAL VIEW", but detected "${resultsArray[0].classification}".`,
        };
      }

      // 3. Shift frames check
      const lastResult = resultsArray[resultsArray.length - 1];
      if (lastResult.classification !== 'VIEWPOINT SHIFT DETECTED') {
        return {
          passed: false,
          failureReason: `Final frame expected "VIEWPOINT SHIFT DETECTED", but detected "${lastResult.classification}".`,
        };
      }

      if (lastResult.transformation.translationDistance < config.translationThresholdPx) {
        return {
          passed: false,
          failureReason: `Measured shift (${lastResult.transformation.translationDistance}px) below threshold (${config.translationThresholdPx}px).`,
        };
      }

      return { passed: true };
    },
  },
];

// --- PARAMETRIC CONTINUOUS STRESS SUITE (PRESERVED) ---

export interface DynamicStressParams {
  rotationDeg: number;
  translationX: number;
  translationY: number;
  zoomScale: number;
  brightnessMult: number;
  occlusionPct: number;
  blurLevel: number;
  blank: boolean;
}

export interface DynamicStressPreset {
  id: string;
  name: string;
  description: string;
  params: DynamicStressParams;
}

export const STRESS_TEST_PRESETS: DynamicStressPreset[] = [
  {
    id: 'preset_subtle_pan',
    name: 'Subtle Pan (+18px, +8px)',
    description: 'Slight pan across horizontal/vertical axes beyond 14px threshold.',
    params: {
      rotationDeg: 0,
      translationX: 18,
      translationY: 8,
      zoomScale: 1.0,
      brightnessMult: 1.0,
      occlusionPct: 0,
      blurLevel: 0,
      blank: false,
    },
  },
  {
    id: 'preset_severe_pan',
    name: 'Severe Diagonal Shift (-45px, +32px)',
    description: 'Major physical dislocation of the camera mount.',
    params: {
      rotationDeg: 0,
      translationX: -45,
      translationY: 32,
      zoomScale: 1.0,
      brightnessMult: 1.0,
      occlusionPct: 0,
      blurLevel: 0,
      blank: false,
    },
  },
  {
    id: 'preset_small_twist',
    name: 'Small Twist (-2.5°)',
    description: 'Moderate rotation around optical axis near the 2.0° threshold.',
    params: {
      rotationDeg: -2.5,
      translationX: 0,
      translationY: 0,
      zoomScale: 1.0,
      brightnessMult: 1.0,
      occlusionPct: 0,
      blurLevel: 0,
      blank: false,
    },
  },
  {
    id: 'preset_large_tilt',
    name: 'Large Mounting Tilt (+8.0°)',
    description: 'Severe angular deflection of camera body.',
    params: {
      rotationDeg: 8.0,
      translationX: 0,
      translationY: 0,
      zoomScale: 1.0,
      brightnessMult: 1.0,
      occlusionPct: 0,
      blurLevel: 0,
      blank: false,
    },
  },
  {
    id: 'preset_zoom_in',
    name: 'Optical Zoom In (1.20x)',
    description: '20% focal length expansion around optical center.',
    params: {
      rotationDeg: 0,
      translationX: 0,
      translationY: 0,
      zoomScale: 1.2,
      brightnessMult: 1.0,
      occlusionPct: 0,
      blurLevel: 0,
      blank: false,
    },
  },
  {
    id: 'preset_zoom_out',
    name: 'Wide Zoom Out (0.85x)',
    description: '15% wide-angle adjustment revealing peripheral margins.',
    params: {
      rotationDeg: 0,
      translationX: 0,
      translationY: 0,
      zoomScale: 0.85,
      brightnessMult: 1.0,
      occlusionPct: 0,
      blurLevel: 0,
      blank: false,
    },
  },
  {
    id: 'preset_sudden_dim',
    name: 'Sudden Evening Dusk (-48% Light)',
    description: 'Large photometric shift without any geometric displacement.',
    params: {
      rotationDeg: 0,
      translationX: 0,
      translationY: 0,
      zoomScale: 1.0,
      brightnessMult: 0.52,
      occlusionPct: 0,
      blurLevel: 0,
      blank: false,
    },
  },
  {
    id: 'preset_bright_flash',
    name: 'Bright Floodlight (+60% Light)',
    description: 'High illumination without any camera movement.',
    params: {
      rotationDeg: 0,
      translationX: 0,
      translationY: 0,
      zoomScale: 1.0,
      brightnessMult: 1.6,
      occlusionPct: 0,
      blurLevel: 0,
      blank: false,
    },
  },
  {
    id: 'preset_partial_occlusion',
    name: 'Partial Occlusion (60% Blocked)',
    description: 'Large barrier blocking major structural landmarks.',
    params: {
      rotationDeg: 0,
      translationX: 0,
      translationY: 0,
      zoomScale: 1.0,
      brightnessMult: 1.0,
      occlusionPct: 60,
      blurLevel: 0,
      blank: false,
    },
  },
];

export function generateParametricScenarioPair(params: DynamicStressParams): {
  referenceDataUrl: string;
  currentDataUrl: string;
  width: number;
  height: number;
  groundTruth: {
    expectedClassification: DetectionClassification;
    expectedShiftPx: number;
    expectedRotationDeg: number;
    expectedScale: number;
    expectedBrightnessPct: number;
  };
} {
  const w = SCENE_W;
  const h = SCENE_H;

  const refCanvas = document.createElement('canvas');
  refCanvas.width = w;
  refCanvas.height = h;
  const refCtx = refCanvas.getContext('2d', { willReadFrequently: true })!;

  if (params.blank) {
    drawInsufficientFeaturesScene(refCtx, w, h);
  } else {
    drawServerRoomScene(refCtx, w, h);
  }

  const currCanvas = document.createElement('canvas');
  currCanvas.width = w;
  currCanvas.height = h;
  const currCtx = currCanvas.getContext('2d', { willReadFrequently: true })!;

  if (params.blank) {
    drawInsufficientFeaturesScene(currCtx, w, h);
  } else {
    currCtx.save();
    currCtx.translate(w / 2 + params.translationX, h / 2 + params.translationY);
    currCtx.rotate((params.rotationDeg * Math.PI) / 180);
    currCtx.scale(params.zoomScale, params.zoomScale);
    currCtx.translate(-w / 2, -h / 2);
    currCtx.drawImage(refCanvas, 0, 0);
    currCtx.restore();

    if (params.occlusionPct > 0) {
      const occWidth = Math.round((w * params.occlusionPct) / 100);
      currCtx.fillStyle = '#7c2d12';
      currCtx.fillRect((w - occWidth) / 2, 80, occWidth, 270);
      currCtx.fillStyle = '#f97316';
      currCtx.font = 'bold 22px sans-serif';
      currCtx.fillText(`BARRIER (${params.occlusionPct}% BLOCKED)`, (w - occWidth) / 2 + 15, 200);
    }

    if (params.brightnessMult !== 1.0) {
      currCtx.fillStyle =
        params.brightnessMult < 1.0
          ? `rgba(0, 0, 0, ${Math.min(0.85, 1.0 - params.brightnessMult)})`
          : `rgba(255, 255, 255, ${Math.min(0.6, (params.brightnessMult - 1.0) * 0.7)})`;
      currCtx.fillRect(0, 0, w, h);
    }
  }

  const shiftDistance = Math.sqrt(
    params.translationX * params.translationX + params.translationY * params.translationY
  );
  let expectedClassification: DetectionClassification = 'NORMAL VIEW';

  if (params.blank) {
    expectedClassification = 'INSUFFICIENT FEATURES';
  } else if (params.occlusionPct >= 50) {
    expectedClassification = 'SCENE CHANGE DETECTED';
  } else {
    const rotSev = Math.abs(params.rotationDeg) / 2.0;
    const transSev = shiftDistance / 14.0;
    const zoomSev = (Math.abs(params.zoomScale - 1.0) * 100) / 5.0;

    if (rotSev >= 1.0 || transSev >= 1.0 || zoomSev >= 1.0) {
      if (rotSev >= transSev && rotSev >= zoomSev) {
        expectedClassification = 'ROTATION DETECTED';
      } else if (zoomSev >= rotSev && zoomSev >= transSev) {
        expectedClassification = 'ZOOM CHANGE DETECTED';
      } else {
        expectedClassification = 'VIEWPOINT SHIFT DETECTED';
      }
    } else if (Math.abs(params.brightnessMult - 1.0) * 100 >= 12.0) {
      expectedClassification = 'LIGHTING VARIATION';
    } else {
      expectedClassification = 'NORMAL VIEW';
    }
  }

  return {
    referenceDataUrl: refCanvas.toDataURL('image/jpeg', 0.95),
    currentDataUrl: currCanvas.toDataURL('image/jpeg', 0.95),
    width: w,
    height: h,
    groundTruth: {
      expectedClassification,
      expectedShiftPx: Number(shiftDistance.toFixed(1)),
      expectedRotationDeg: Number(params.rotationDeg.toFixed(2)),
      expectedScale: Number(params.zoomScale.toFixed(2)),
      expectedBrightnessPct: Math.round(params.brightnessMult * 100),
    },
  };
}
