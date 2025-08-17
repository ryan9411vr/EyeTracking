// src/components/molecules/checkboxes/ConvertRightAutoencoderCheckboxMolecule.tsx
/**
 * ConvertRightAutoencoderCheckboxMolecule
 *
 * Toggles whether to convert the trained right-eye autoencoder.
 */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { setConvertRightAutoencoder } from '../../../slices/configSlice';
import { useTranslation } from 'react-i18next';
import CheckboxWithLabel from '../../atoms/CheckboxWithLabel';

const ConvertRightAutoencoderCheckboxMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const enabled = useSelector(
    (state: RootState) => state.config.convertRightAutoencoder
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setConvertRightAutoencoder(e.target.checked));
  };

  return (
    <CheckboxWithLabel
      label={t('Training.convertRightAutoencoder')}
      tooltip={t('Training.convertRightAutoencoderTooltip')}
      checked={enabled}
      onChange={handleChange}
    />
  );
};

export default ConvertRightAutoencoderCheckboxMolecule;
