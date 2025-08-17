// src/components/molecules/checkboxes/TrainRightAutoencoderCheckboxMolecule.tsx
/**
 * TrainRightAutoencoderCheckboxMolecule
 *
 * Toggles whether to train the right-eye autoencoder.
 */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { setTrainRightAutoencoder } from '../../../slices/configSlice';
import { useTranslation } from 'react-i18next';
import CheckboxWithLabel from '../../atoms/CheckboxWithLabel';

const TrainRightAutoencoderCheckboxMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const enabled = useSelector(
    (state: RootState) => state.config.trainRightAutoencoder
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setTrainRightAutoencoder(e.target.checked));
  };

  return (
    <CheckboxWithLabel
      label={t('Training.trainRightAutoencoder')}
      tooltip={t('Training.trainRightAutoencoderTooltip')}
      checked={enabled}
      onChange={handleChange}
    />
  );
};

export default TrainRightAutoencoderCheckboxMolecule;
