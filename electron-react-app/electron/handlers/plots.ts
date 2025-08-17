// electron/main/ipc/handlers/plots.ts
import { handle } from '../ipc/router';
import { createThetaHeatmap } from '../training/displayUtils';

export function registerPlotHandlers() {
  handle('generate-theta-heatmap', async (_e, dbPath) => await createThetaHeatmap(dbPath));
}
