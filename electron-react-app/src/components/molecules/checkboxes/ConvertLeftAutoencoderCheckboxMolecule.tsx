// src/components/molecules/checkboxes/ConvertLeftAutoencoderCheckboxMolecule.tsx
/**
 * ConvertLeftAutoencoderCheckboxMolecule
 *
 * Toggles whether to convert the trained left-eye autoencoder.
 */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { setConvertLeftAutoencoder } from '../../../slices/configSlice';
import { useTranslation } from 'react-i18next';
import CheckboxWithLabel from '../../atoms/CheckboxWithLabel';

const ConvertLeftAutoencoderCheckboxMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const enabled = useSelector(
    (state: RootState) => state.config.convertLeftAutoencoder
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setConvertLeftAutoencoder(e.target.checked));
  };

  return (
    <CheckboxWithLabel
      label={t('Training.convertLeftAutoencoder', {
        defaultValue: 'Convert Left Autoencoder',
      })}
      tooltip={t('Training.convertLeftAutoencoderTooltip', {
        defaultValue:
          'Enable conversion/export of the left-eye autoencoder model after training.',
      })}
      checked={enabled}
      onChange={handleChange}
    />
  );
};

export default ConvertLeftAutoencoderCheckboxMolecule;
