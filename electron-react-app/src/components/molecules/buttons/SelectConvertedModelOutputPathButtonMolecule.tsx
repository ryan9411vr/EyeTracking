// src/components/molecules/buttons/SelectConvertedModelOutputPathButtonMolecule.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import ButtonAtom from '../../atoms/ButtonAtom';

interface SelectConvertedModelOutputPathButtonMoleculeProps {
  onSelectConvertedModelOutputPath: () => void;
}

const SelectConvertedModelOutputPathButtonMolecule: React.FC<
  SelectConvertedModelOutputPathButtonMoleculeProps
> = ({ onSelectConvertedModelOutputPath }) => {
  const { t } = useTranslation();

  return (
    <ButtonAtom
      text={t('Training.selectConvertedModelOutputPath')}
      onClick={onSelectConvertedModelOutputPath}
      className="text-button-color background-color-accent-neutral mr-1"
    />
  );
};

export default SelectConvertedModelOutputPathButtonMolecule;
