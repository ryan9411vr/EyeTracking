// src/components/molecules/buttons/RunAutoencoderTrainingButtonMolecule.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import ButtonAtom from '../../atoms/ButtonAtom';

interface RunAutoencoderTrainingButtonMoleculeProps {
  onRunAutoencoderTraining: () => void;
}

const RunAutoencoderTrainingButtonMolecule: React.FC<RunAutoencoderTrainingButtonMoleculeProps> =
  ({ onRunAutoencoderTraining }) => {

  const { t } = useTranslation();

  return (
    <ButtonAtom
      text={t('Training.runAutoencoderTraining')}
      onClick={onRunAutoencoderTraining}
      className="text-button-color background-color-accent-good background-color-accent-neutral"
    />
  );
};

export default RunAutoencoderTrainingButtonMolecule;
