// src/components/card/OpennessConfigurationCard.tsx

import React from "react";
import { useTranslation } from "react-i18next";
import OpennessConfigurationMolecule from "../molecules/OpennessConfigurationMolecule";
import CalibrateClosedButtonMolecule from "../molecules/buttons/CalibrateClosedButtonMolecule";
import CalibrateOpenButtonMolecule from "../molecules/buttons/CalibrateOpenButtonMolecule";
import CalibrateSlowBlinkButtonMolecule from "../molecules/buttons/CalibrateSlowBlinkButtonMolecule";
import CalibrationPlotButtonMolecule from "../molecules/buttons/CalibrationPlotButtonMolecule";
import CalibrationPlotMolecule from "../molecules/CalibrationPlotMolecule";

/**
 * OpennessConfigurationCard
 *
 * Displays the openness‑configuration controls plus a row of calibration
 * buttons at the bottom.
 */

const OpennessConfigurationCard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="card">
      <div className="card-header text-header-color text-header">
        {t("OpennessConfigurationCard.header")}
      </div>

      {/* Main openness settings */}
      <div className="text-normal text-standard-color mb-1">
        <OpennessConfigurationMolecule />
      </div>

      {/* Calibration buttons row */}
      <div className="flex-label text-button-color">
        <CalibrateClosedButtonMolecule />
        <CalibrateOpenButtonMolecule />
        ▶
        <CalibrateSlowBlinkButtonMolecule />
        <CalibrationPlotButtonMolecule />
      </div>

      <CalibrationPlotMolecule />
    </div>
  );
};

export default OpennessConfigurationCard;
