// src/components/molecules/text/CtxFilterTextMolecule.tsx
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { setCtxFilter } from '../../../slices/configSlice';
import { useTranslation } from 'react-i18next';
import TextInputWithLabel from '../../atoms/TextInputWithLabel';

/**
 * CtxFilterTextMolecule Component
 *
 * Tracks and updates the ctxFilter string in Redux (state.config.ctxFilter).
 * Dispatches updates via setCtxFilter and renders a labeled text input.
 */
const CtxFilterTextMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const ctxFilter = useSelector((state: RootState) => state.config.ctxFilter);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setCtxFilter(e.target.value));
  };

  return (
    <TextInputWithLabel
      label={t('CtxFilter.ctxFilter', "Camera Filter - Requires Retraining")}
      tooltip={t("CtxFilter.ctxFilterTooltip", "Search CanvasRenderingContext2D: filter property online")}
      value={ctxFilter ?? ''}
      placeholder={t('CtxFilter.ctxFilterPlaceholder', "Enter Canvas Filter: Optional")}
      onChange={handleChange}
    />
  );
};

export default CtxFilterTextMolecule;
