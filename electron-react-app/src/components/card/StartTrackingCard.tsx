// src/components/card/StartTrackingCard.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import VrcNativeMolecule from '../molecules/checkboxes/VrcNativeCheckboxMolecule';
import VrcftV1Molecule from '../molecules/checkboxes/VrcftV1CheckboxMolecule';
import VrcftV2Molecule from '../molecules/checkboxes/VrcftV2CheckboxMolecule';
import SplitYOutMolecule from '../molecules/checkboxes/SplitYOutCheckboxMolecule';
import SyncedEyeUpdatesMolecule from '../molecules/checkboxes/SyncedUpdateCheckboxMolecule';
import IndependentEyesMolecule from '../molecules/checkboxes/IndependentEyesCheckboxMolecule';
import IndependentOpennessMolecule from '../molecules/checkboxes/IndependentEyelidsCheckboxMolecule';
import ActiveEyeTrackingMolecule from '../molecules/checkboxes/EyeTrackingCheckboxMolecule';
import ActiveOpennessTrackingMolecule from '../molecules/checkboxes/EyelidTrackingCheckboxMolecule';
import OscInputMolecule from '../molecules/text/OscInputTextMolecule';
import VrcftPrefixMolecule from '../molecules/text/VrcftPrefixTextMolecule';
import VrcNativeNeutralValueMolecule from '../molecules/sliders/VrcNativeNeutralValueMolecule';

const StartTrackingCard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="card">
      <div className="card-header text-header-color text-header">
        <span className="status-title">{t('StartTrackingCard.header')}</span>
      </div>
      <div className="text-normal text-standard-color">
        <OscInputMolecule />
        <VrcftPrefixMolecule />
        <div className="mb-1">
          <VrcNativeNeutralValueMolecule />
        </div>

        {/* Grid for toggles */}
        <div className="start-tracking-grid">
          {/* Left Column (45%) */}
          <div className="grid-column">
            <VrcNativeMolecule />
            <VrcftV1Molecule />
            <VrcftV2Molecule />
            <SplitYOutMolecule />
            <SyncedEyeUpdatesMolecule />
          </div>
          {/* Right Column (55%) */}
          <div className="grid-column">
            <IndependentEyesMolecule />
            <IndependentOpennessMolecule />
            <ActiveEyeTrackingMolecule />
            <ActiveOpennessTrackingMolecule />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartTrackingCard;
