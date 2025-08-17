// src/components/molecules/OutputTrainedModelPathMolecule.tsx
import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useTranslation } from 'react-i18next';

const OutputTrainedModelPathMolecule: React.FC = () => {
  const { t } = useTranslation();
  const selectedDb = useSelector((state: RootState) => state.config.outputTrainedModelPath);

  return (
    <p>
      {t("OutputTrainedModelPathMolecule.label")}{" "}
      <strong>{selectedDb || t("OutputTrainedModelPathMolecule.none")}</strong>
    </p>
  );
};

export default OutputTrainedModelPathMolecule;
