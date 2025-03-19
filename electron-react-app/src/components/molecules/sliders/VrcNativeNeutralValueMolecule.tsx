// src/components/molecules/sliders/VrcNativeNeutralValueMolecule.tsx

/**
 * VrcNativeNeutralValueMolecule component
 *
 * A molecule component for controlling the vrcNativeNeutralValue.
 * It reads the vrcNativeNeutralValue value from Redux and dispatches updates using
 * the setvrcNativeNeutralValue action. It renders the SliderWithLabel atom.
 */

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { setvrcNativeNeutralValue } from '../../../slices/configSlice';
import { useTranslation } from 'react-i18next';
import SliderWithLabel from '../../atoms/SliderWithLabel';

const VrcNativeNeutralValueMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const vrcNativeNeutralValue = useSelector(
    (state: RootState) => state.config.vrcNativeNeutralValue
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setvrcNativeNeutralValue(Number(e.target.value)));
  };

  return (
    <SliderWithLabel
      label={t('TrackingConfigurationCard.nativeNeutralValueLabel', { value: vrcNativeNeutralValue })}
      tooltip={t('TrackingConfigurationCard.nativeNeutralValueTooltip')}
      value={vrcNativeNeutralValue}
      min={0}
      max={1}
      step={0.01}
      onChange={handleChange}
    />
  );
};

export default VrcNativeNeutralValueMolecule;
