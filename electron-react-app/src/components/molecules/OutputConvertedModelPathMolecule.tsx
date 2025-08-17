// src/components/molecules/OutputConvertedModelPathMolecule.tsx
import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useTranslation } from 'react-i18next';

const OutputConvertedModelPathMolecule: React.FC = () => {
  const { t } = useTranslation();
  const selectedDb = useSelector((state: RootState) => state.config.outputConvertedModelPath);

  return (
    <p>
      {t("OutputConvertedModelPathMolecule.label")}{" "}
      <strong>{selectedDb || t("OutputConvertedModelPathMolecule.none")}</strong>
    </p>
  );
};

export default OutputConvertedModelPathMolecule;
