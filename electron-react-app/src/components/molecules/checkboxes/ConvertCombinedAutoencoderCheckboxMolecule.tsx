// src/components/molecules/checkboxes/ConvertCombinedAutoencoderCheckboxMolecule.tsx
/**
 * ConvertCombinedAutoencoderCheckboxMolecule
 *
 * Toggles whether to convert the trained combined autoencoder (e.g., to TF.js).
 */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { setConvertCombinedAutoencoder } from '../../../slices/configSlice';
import { useTranslation } from 'react-i18next';
import CheckboxWithLabel from '../../atoms/CheckboxWithLabel';

const ConvertCombinedAutoencoderCheckboxMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const enabled = useSelector(
    (state: RootState) => state.config.convertCombinedAutoencoder
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setConvertCombinedAutoencoder(e.target.checked));
  };

  return (
    <CheckboxWithLabel
      label={t('Training.convertCombinedAutoencoder')}
      tooltip={t('Training.convertCombinedAutoencoderTooltip')}
      checked={enabled}
      onChange={handleChange}
    />
  );
};

export default ConvertCombinedAutoencoderCheckboxMolecule;
