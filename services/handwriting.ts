
import { Stroke, Point } from '../types';

/**
 * Normalizes strokes to a 0-1 bounding box and resamples to N points.
 */
export const normalizeAndResample = (strokes: Stroke[], nPoints: number = 32): Point[] => {
  // Flatten all points
  const allPoints = strokes.flat();
  if (allPoints.length === 0) return [];

  // Find bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  allPoints.forEach(p => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  // Normalize
  const normalized = allPoints.map(p => ({
    x: (p.x - minX) / width,
    y: (p.y - minY) / height,
    t: p.t
  }));

  // Resample (very simple version: just pick N points evenly spaced)
  const resampled: Point[] = [];
  if (normalized.length <= nPoints) {
    return normalized;
  }

  for (let i = 0; i < nPoints; i++) {
    const idx = Math.floor((i / (nPoints - 1)) * (normalized.length - 1));
    resampled.push(normalized[idx]);
  }

  return resampled;
};

/**
 * Simple distance-based similarity. 1.0 is perfect match, 0.0 is completely different.
 */
export const calculateSimilarity = (userPoints: Point[], templatePoints: Point[]): number => {
  if (userPoints.length === 0 || templatePoints.length === 0) return 0;
  
  // Ensure same length
  const len = Math.min(userPoints.length, templatePoints.length);
  let totalDist = 0;
  
  for (let i = 0; i < len; i++) {
    const dx = userPoints[i].x - templatePoints[i].x;
    const dy = userPoints[i].y - templatePoints[i].y;
    totalDist += Math.sqrt(dx * dx + dy * dy);
  }

  const avgDist = totalDist / len;
  // Heuristic mapping: avgDist of 0.1 is very good, 0.5 is bad
  return Math.max(0, 1 - (avgDist * 2));
};
