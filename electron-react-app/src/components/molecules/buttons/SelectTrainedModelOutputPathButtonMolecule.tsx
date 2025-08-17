// src/components/molecules/buttons/SelectTrainedModelOutputPathButtonMolecule.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import ButtonAtom from '../../atoms/ButtonAtom';

interface SelectTrainedModelOutputPathButtonMoleculeProps {
  onSelectTrainedModelOutputPath: () => void;
}

const SelectTrainedModelOutputPathButtonMolecule: React.FC<
  SelectTrainedModelOutputPathButtonMoleculeProps
> = ({ onSelectTrainedModelOutputPath }) => {
  const { t } = useTranslation();

  return (
    <ButtonAtom
      text={t('Training.selectTrainedModelOutputPath')}
      onClick={onSelectTrainedModelOutputPath}
      className="text-button-color background-color-accent-neutral mr-1"
    />
  );
};

export default SelectTrainedModelOutputPathButtonMolecule;
