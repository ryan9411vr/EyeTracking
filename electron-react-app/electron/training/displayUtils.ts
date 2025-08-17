// /training/displayUtils.ts

import * as sqlite3 from 'sqlite3';
import { createCanvas } from 'canvas';

/**
 * Helper function to interpolate between two colors.
 */
function interpolateColor(
  t: number,
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): { r: number; g: number; b: number } {
  return {
    r: Math.round(color1.r + t * (color2.r - color1.r)),
    g: Math.round(color1.g + t * (color2.g - color1.g)),
    b: Math.round(color1.b + t * (color2.b - color1.b))
  };
}

/**
 * Approximates the viridis colormap.
 * Input v should be in [0, 1] and returns an rgb(...) string.
 */
function getViridisColor(v: number): string {
  const stops = [
    { t: 0.0, r: 68,  g: 1,   b: 84  },
    { t: 0.33, r: 59, g: 82,  b: 139 },
    { t: 0.66, r: 33, g: 145, b: 140 },
    { t: 1.0, r: 253, g: 231, b: 37  }
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    if (v >= stops[i].t && v <= stops[i + 1].t) {
      const tNormalized = (v - stops[i].t) / (stops[i + 1].t - stops[i].t);
      const { r, g, b } = interpolateColor(tNormalized, stops[i], stops[i + 1]);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  // In case v is exactly 1:
  const last = stops[stops.length - 1];
  return `rgb(${last.r}, ${last.g}, ${last.b})`;
}

/**
 * Queries the given SQLite database for theta1 and theta2 values,
 * builds a 2D heatmap image (using 50 bins and a viridis colormap),
 * and returns the PNG image as a base64 encoded string.
 *
 * @param dbPath - The file path to the SQLite database.
 * @returns A Promise that resolves to a base64 encoded PNG string.
 */
export async function createThetaHeatmap(dbPath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    // Open the database in read-only mode.
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error("Error opening database:", err);
        return reject(err);
      }
    });

    const query = `
      SELECT theta1, theta2
      FROM training_data
      WHERE (leftEyeFrame != '' OR rightEyeFrame != '')
        AND type = 'gaze'
      ORDER BY RANDOM()
      LIMIT 50000
    `;
    db.all(query, (err, rows: { theta1: number; theta2: number }[]) => {
      if (err) {
        db.close();
        return reject(err);
      }
      if (!rows || rows.length === 0) {
        db.close();
        return reject(new Error("No training data found."));
      }

      // Separate theta1 and theta2 values.
      const theta1Values = rows.map(r => -r.theta1);
      const theta2Values = rows.map(r => -r.theta2);

      // Compute min and max for each.
      const minTheta1 = Math.min(...theta1Values);
      const maxTheta1 = Math.max(...theta1Values);
      const minTheta2 = Math.min(...theta2Values);
      const maxTheta2 = Math.max(...theta2Values);

      // Set number of bins.
      const bins = 50;
      const grid = Array.from({ length: bins }, () => new Array(bins).fill(0));

      // Populate the 2D histogram grid.
      rows.forEach(({ theta1, theta2 }) => {
        theta1 = -theta1;
        theta2 = -theta2;
        const x = Math.floor(((theta2 - minTheta2) / (maxTheta2 - minTheta2)) * (bins - 1));
        const y = Math.floor(((theta1 - minTheta1) / (maxTheta1 - minTheta1)) * (bins - 1));
        grid[y][x] += 1;
      });

      // Find maximum count for normalization.
      let maxCount = 0;
      for (let y = 0; y < bins; y++) {
        for (let x = 0; x < bins; x++) {
          if (grid[y][x] > maxCount) {
            maxCount = grid[y][x];
          }
        }
      }

      const canvas = createCanvas(bins, bins);
      const ctx = canvas.getContext('2d');

      // Clear canvas (transparent background).
      ctx.clearRect(0, 0, bins, bins);

      // Draw each bin.
      for (let y = 0; y < bins; y++) {
        for (let x = 0; x < bins; x++) {
          const count = grid[y][x];
          // Normalize the count to [0,1].
          const ratio = count / maxCount;
          // Get the color from the viridis colormap.
          const color = getViridisColor(ratio);
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }

      // Convert the canvas to a PNG buffer, then encode as base64.
      const buffer = canvas.toBuffer('image/png');
      const base64String = buffer.toString('base64');

      db.close((closeErr) => {
        if (closeErr) {
          console.error("Error closing database:", closeErr);
          return reject(closeErr);
        }
        resolve(base64String);
      });
    });
  });
}