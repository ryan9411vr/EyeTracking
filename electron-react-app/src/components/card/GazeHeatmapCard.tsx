// src/components/card/GazeHeatmapCard.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import HeatmapImageDisplayMolecule from '../molecules/HeatmapImageDisplayMolecule';
import HeatmapGenerateButtonMolecule from '../molecules/buttons/HeatmapGenerateButtonMolecule';
import { RootState } from '../../store';
import { setHeatmapImageData } from '../../slices/statusSlice';

const GazeHeatmapCard: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  // Get the selected database file path from the database slice.
  const selectedDb = useSelector((state: RootState) => state.database.selectedDb);

  // generates the heatmap and stores it in the status slice.
  const handleGenerateHeatmap = async () => {
    try {
      if (!selectedDb) {
        console.error('No database selected.');
        return;
      }
      // Call the Electron API to generate the theta heatmap (returns a base64 PNG).
      const base64Png = await window.electronAPI.generateThetaHeatmap(selectedDb);
      // Dispatch the reducer to store the heatmap image data.
      dispatch(setHeatmapImageData(base64Png));
    } catch (error) {
      console.error('Error generating heatmap:', error);
    }
  };

  return (
    <div className="card">
      <div className="card-header text-header-color text-header">
        <span>{t('HeatmapCard.heatmapHeader')}</span>
      </div>
      <div className="text-normal text-standard-color mb-1 ">
        <HeatmapImageDisplayMolecule />
      </div>
      <div>
        <HeatmapGenerateButtonMolecule onClick={handleGenerateHeatmap} />
      </div>
    </div>
  );
};

export default GazeHeatmapCard;
