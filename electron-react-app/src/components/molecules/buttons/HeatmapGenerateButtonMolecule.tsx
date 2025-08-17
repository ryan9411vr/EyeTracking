// src/components/molecules/buttons/HeatmapGenerateButtonMolecule.tsx

import React from 'react';
import { useTranslation } from 'react-i18next';
import ButtonAtom from '../../atoms/ButtonAtom';

interface HeatmapGenerateButtonMoleculeProps {
  onClick: () => void;
}

const HeatmapGenerateButtonMolecule: React.FC<HeatmapGenerateButtonMoleculeProps> = ({ onClick }) => {
  const { t } = useTranslation();

  return (
    <ButtonAtom
      text={t('HeatmapGenerateButton.select')}
      onClick={onClick}
      className="text-button-color background-color-accent-neutral"
    />
  );
};

export default HeatmapGenerateButtonMolecule;
