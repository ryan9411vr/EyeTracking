// src/components/molecules/text/LeftEyeImageDataTextMolecule.tsx
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState, AppDispatch } from '../../../store';
import { setLeftEye } from '../../../slices/configSlice';
import TextInputWithLabel from '../../atoms/TextInputWithLabel';

const LeftEyeMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch: AppDispatch = useDispatch();
  const leftEye = useSelector((state: RootState) => state.config.leftEye);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setLeftEye(e.target.value));
  };

  return (
    <div className="form-group mb-1">
      <div className="space-between mb-p5">
        <label htmlFor="leftEye">
          {t('ConfigurationSection.leftEyeLabel')}
        </label>
      </div>
      <TextInputWithLabel
        label=""
        value={leftEye}
        placeholder={t('ConfigurationSection.ipPortLeftPlaceholder')}
        onChange={handleChange}
      />
    </div>
  );
};

export default LeftEyeMolecule;
