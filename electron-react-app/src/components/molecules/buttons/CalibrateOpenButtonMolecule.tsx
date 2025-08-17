// src/components/molecules/buttons/CalibrateOpenButtonMolecule.tsx

/**
 * CalibrateOpenButtonMolecule
 *
 * When pressed:
 *  1) After 0.5s, play beep.mp3 and setOpenCalibrationActive(true)
 *  2) After an additional 5s, play beep.mp3 again and setOpenCalibrationActive(false)
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { setOpenCalibrationActive } from "../../../slices/statusSlice";
import ButtonAtom from "../../atoms/ButtonAtom";

const CalibrateOpenButtonMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const playBeep = () => {
    const audio = new Audio("/beep.mp3");
    audio.play().catch((err) => {
      console.error("Failed to play beep:", err);
    });
  };

  const handlePress = () => {
    // After 0.5s: play sound + set active true
    setTimeout(() => {
      playBeep();
      dispatch(setOpenCalibrationActive(true));

      // After an additional 5s: play sound again + set active false
      setTimeout(() => {
        playBeep();
        dispatch(setOpenCalibrationActive(false));
      }, 5000);
    }, 500);
  };

  return (
    <ButtonAtom
      text={t("CalibrateOpenButton.select")}
      onClick={handlePress}
      className="text-button-color background-color-accent-neutral"
    />
  );
};

export default CalibrateOpenButtonMolecule;
