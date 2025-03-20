// src/components/molecules/text/RightEyeImageDataTextMolecule.tsx

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState, AppDispatch } from '../../../store';
import { setRightEye } from '../../../slices/configSlice';
import TextInputWithLabel from '../../atoms/TextInputWithLabel';

const RightEyeMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch: AppDispatch = useDispatch();
  const rightEye = useSelector((state: RootState) => state.config.rightEye);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setRightEye(e.target.value));
  };

  return (
    <div className="form-group">
      <div className="space-between mb-p5">
        <label htmlFor="rightEye">
          {t('ConfigurationSection.rightEyeLabel')}
        </label>
      </div>
      <TextInputWithLabel
        label=""
        value={rightEye}
        placeholder={t('ConfigurationSection.ipPortLeftPlaceholder')}
        onChange={handleChange}
      />
    </div>
  );
};

export default RightEyeMolecule;
