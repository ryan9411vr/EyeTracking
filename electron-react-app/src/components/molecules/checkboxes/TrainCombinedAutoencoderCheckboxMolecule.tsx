// src/components/molecules/checkboxes/TrainCombinedAutoencoderCheckboxMolecule.tsx
/**
 * TrainCombinedAutoencoderCheckboxMolecule
 *
 * Toggles whether to train the combined (left+right) autoencoder.
 * Reads `trainCombinedAutoencoder` from Redux and dispatches updates via
 * `setTrainCombinedAutoencoder`. Renders the CheckboxWithLabel atom.
 */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { setTrainCombinedAutoencoder } from '../../../slices/configSlice';
import { useTranslation } from 'react-i18next';
import CheckboxWithLabel from '../../atoms/CheckboxWithLabel';

const TrainCombinedAutoencoderCheckboxMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const trainCombined = useSelector(
    (state: RootState) => state.config.trainCombinedAutoencoder
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setTrainCombinedAutoencoder(e.target.checked));
  };

  return (
    <CheckboxWithLabel
      label={t('Training.trainCombinedAutoencoder')}
      tooltip={t('Training.trainCombinedAutoencoderTooltip')}
      checked={trainCombined}
      onChange={handleChange}
    />
  );
};

export default TrainCombinedAutoencoderCheckboxMolecule;
