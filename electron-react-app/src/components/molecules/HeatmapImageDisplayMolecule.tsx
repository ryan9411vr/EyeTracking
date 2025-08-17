// src/components/molecules/HeatmapImageDisplayMolecule.tsx

import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useTranslation } from 'react-i18next';

const HeatmapImageDisplayMolecule: React.FC = () => {
  const { t } = useTranslation();
  // Updated selector path to use the heatmapImageData field from the status slice
  const heatmapImageData = useSelector((state: RootState) => state.status.heatmapImageData);

  if (!heatmapImageData) {
    return (
      <div className="mt-1">
        <div
          className=""
          style={{ width: '240px', height: '240px', border: '3px solid black', backgroundColor: "#32003f"}}
        />
      </div>
    );
  }

  const imageUrl = `data:image/png;base64,${heatmapImageData}`;

  return (
    <div className="mt-1 ">
      <img 
        src={imageUrl} 
        alt={t('ImageDisplayMolecule.altText')} 
        style={{ width: '240px', height: '240px', border: '3px solid black', backgroundColor: "#32003f"}} 
      />
    </div>
  );
};

export default HeatmapImageDisplayMolecule;
