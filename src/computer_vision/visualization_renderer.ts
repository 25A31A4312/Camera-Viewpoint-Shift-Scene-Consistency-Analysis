/**
 * Visualization Renderer Module
 * Renders side-by-side feature matches, inlier vectors, and geometric alignment overlays onto HTML5 canvas.
 */

import { FrameAnalysisResult, MatchPair, ReferenceScene } from '../types';

export interface RenderMatchesOptions {
  showOutliers?: boolean;
  maxLinesToDraw?: number;
  highlightInliers?: boolean;
  theme?: 'dark' | 'light';
}

/**
 * Draws the side-by-side feature matching visualization:
 * Left: Reference scene
 * Right: Current analyzed frame
 * Lines: Green vectors for RANSAC inliers, Amber for outliers
 */
export function renderMatchesCanvas(
  targetCanvas: HTMLCanvasElement,
  refImg: HTMLImageElement | HTMLCanvasElement,
  currImg: HTMLImageElement | HTMLCanvasElement,
  matches: MatchPair[],
  result: FrameAnalysisResult | null,
  options: RenderMatchesOptions = {}
): void {
  const {
    showOutliers = true,
    maxLinesToDraw = 80,
    highlightInliers = true,
  } = options;

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  const w1 = refImg.width;
  const h1 = refImg.height;
  const w2 = currImg.width;
  const h2 = currImg.height;

  // Set uniform rendering height
  const targetH = 340;
  const scale1 = targetH / h1;
  const scale2 = targetH / h2;

  const drawW1 = Math.round(w1 * scale1);
  const drawW2 = Math.round(w2 * scale2);
  const totalW = drawW1 + drawW2;

  targetCanvas.width = totalW;
  targetCanvas.height = targetH;

  // Clear background
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, 0, totalW, targetH);

  // Draw both images
  ctx.drawImage(refImg, 0, 0, drawW1, targetH);
  ctx.drawImage(currImg, drawW1, 0, drawW2, targetH);

  // Draw subtle vertical divider
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(drawW1, 0);
  ctx.lineTo(drawW1, targetH);
  ctx.stroke();

  // Draw headers/labels on each side
  ctx.font = '600 11px JetBrains Mono, monospace';

  // Reference label
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.fillRect(8, 8, 130, 22);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('REF: BASELINE SCENE', 14, 23);

  // Current frame label
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.fillRect(drawW1 + 8, 8, 145, 22);
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(result ? `CURR: FRAME #${result.frameNumber}` : 'CURR: INCOMING FRAME', drawW1 + 14, 23);

  if (!matches || matches.length === 0) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.fillRect(totalW / 2 - 100, targetH / 2 - 16, 200, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 12px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No feature matches found', totalW / 2, targetH / 2 + 4);
    ctx.textAlign = 'start';
    return;
  }

  // Separate inliers and outliers
  const inliers = matches.filter(m => m.isInlier);
  const outliers = matches.filter(m => !m.isInlier);

  // Draw outliers first if enabled (dim amber/orange)
  if (showOutliers) {
    const drawOutliers = outliers.slice(0, Math.floor(maxLinesToDraw * 0.3));
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.28)';
    ctx.lineWidth = 1;

    for (let i = 0; i < drawOutliers.length; i++) {
      const m = drawOutliers[i];
      const x1 = m.pt1[0] * scale1;
      const y1 = m.pt1[1] * scale1;
      const x2 = drawW1 + m.pt2[0] * scale2;
      const y2 = m.pt2[1] * scale2;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Keypoint marker on ref
      ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.beginPath();
      ctx.arc(x1, y1, 2, 0, Math.PI * 2);
      ctx.fill();

      // Keypoint marker on curr
      ctx.beginPath();
      ctx.arc(x2, y2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw inliers (crisp emerald green vectors)
  const drawInliers = inliers.slice(0, maxLinesToDraw);
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)';
  ctx.lineWidth = 1.5;

  for (let i = 0; i < drawInliers.length; i++) {
    const m = drawInliers[i];
    const x1 = m.pt1[0] * scale1;
    const y1 = m.pt1[1] * scale1;
    const x2 = drawW1 + m.pt2[0] * scale2;
    const y2 = m.pt2[1] * scale2;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (highlightInliers) {
      // Keypoint circle on ref
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(x1, y1, 3, 0, Math.PI * 2);
      ctx.fill();

      // Keypoint circle on current
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(x2, y2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Bottom info banner overlay
  ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
  ctx.fillRect(0, targetH - 26, totalW, 26);

  ctx.font = '500 11px JetBrains Mono, monospace';
  ctx.fillStyle = '#10b981';
  ctx.fillText(`● Inliers: ${inliers.length} / ${matches.length} (${result ? (result.inlierRatio * 100).toFixed(0) : 0}%)`, 12, targetH - 9);

  if (showOutliers) {
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`▲ Outliers: ${outliers.length}`, 190, targetH - 9);
  }

  if (result) {
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'right';
    ctx.fillText(`dx: ${result.transformation.translationX}px  rot: ${result.transformation.rotationDegrees}°  zoom: ${(result.transformation.scaleChange * 100).toFixed(1)}%`, totalW - 12, targetH - 9);
    ctx.textAlign = 'start';
  }
}

/**
 * Creates an aligned difference overlay between reference and current frame.
 * Applies estimated affine matrix to reference image and displays difference.
 */
export function renderDifferenceOverlay(
  targetCanvas: HTMLCanvasElement,
  refImg: HTMLImageElement | HTMLCanvasElement,
  currImg: HTMLImageElement | HTMLCanvasElement,
  result: FrameAnalysisResult | null
): void {
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  const w = currImg.width;
  const h = currImg.height;

  targetCanvas.width = w;
  targetCanvas.height = h;

  // Draw current frame as base
  ctx.globalAlpha = 1.0;
  ctx.drawImage(currImg, 0, 0, w, h);

  if (!result || !result.transformation) return;

  // Draw transformed reference overlay with 50% opacity and 'difference' blend
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.globalCompositeOperation = 'difference';

  const m = result.transformation.matrix;
  // Canvas setTransform(a, b, c, d, e, f) corresponds to:
  // [ a  c  e ]
  // [ b  d  f ]
  // [ 0  0  1 ]
  // In our similarity matrix:
  // m[0][0] = a, m[0][1] = -b, m[0][2] = tx
  // m[1][0] = b, m[1][1] = a,  m[1][2] = ty
  ctx.setTransform(m[0][0], m[1][0], m[0][1], m[1][1], m[0][2], m[1][2]);
  ctx.drawImage(refImg, 0, 0, w, h);
  ctx.restore();

  // Reset blend mode
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;
}
