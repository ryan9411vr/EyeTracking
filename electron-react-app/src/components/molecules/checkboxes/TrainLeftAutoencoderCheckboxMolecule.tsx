// src/components/molecules/checkboxes/TrainLeftAutoencoderCheckboxMolecule.tsx
/**
 * TrainLeftAutoencoderCheckboxMolecule
 *
 * Toggles whether to train the left-eye autoencoder.
 */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { setTrainLeftAutoencoder } from '../../../slices/configSlice';
import { useTranslation } from 'react-i18next';
import CheckboxWithLabel from '../../atoms/CheckboxWithLabel';

const TrainLeftAutoencoderCheckboxMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const enabled = useSelector(
    (state: RootState) => state.config.trainLeftAutoencoder
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setTrainLeftAutoencoder(e.target.checked));
  };

  return (
    <CheckboxWithLabel
      label={t('Training.trainLeftAutoencoder')}
      tooltip={t('Training.trainLeftAutoencoderTooltip')}
      checked={enabled}
      onChange={handleChange}
    />
  );
};

export default TrainLeftAutoencoderCheckboxMolecule;
