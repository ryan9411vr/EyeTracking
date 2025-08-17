// src/components/molecules/buttons/CalibrationPlotButtonMolecule.tsx

import React, { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { RootState } from "../../../store";
import { toggleCalibrationPlotExpanded } from "../../../slices/configSlice";
import ButtonAtom from "../../atoms/ButtonAtom";

const CalibrationPlotButtonMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const enabled = useSelector((s: RootState) => s.config.calibrationPlotEnabled);
  const expanded = useSelector((s: RootState) => s.config.calibrationPlotExpanded);

  const label = useMemo(
    () => `${t("CalibrationPlotCard.header")} ${expanded ? "▼" : "►"}`,
    [expanded, t]
  );

  if (!enabled) return null;

  return (
    <ButtonAtom
      text={label}
      onClick={() => dispatch(toggleCalibrationPlotExpanded())}
      className="text-button-color background-color-accent-neutral"
    />
  );
};

export default CalibrationPlotButtonMolecule;
