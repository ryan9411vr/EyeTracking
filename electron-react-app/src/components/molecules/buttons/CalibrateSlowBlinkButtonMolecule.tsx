// src/components/molecules/buttons/CalibrateSlowBlinkButtonMolecule.tsx

/**
 * CalibrateSlowBlinkButtonMolecule
 *
 * When pressed:
 *  1) After 0.5s, play beep.mp3 and setBlinkCalibrationActive(true)
 *  2) After an additional 10s, play beep.mp3 again and setBlinkCalibrationActive(false)
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { setBlinkCalibrationActive } from "../../../slices/statusSlice";
import ButtonAtom from "../../atoms/ButtonAtom";
import beepUrl from "../../../../public/beep.mp3";

const CalibrateSlowBlinkButtonMolecule: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const playBeep = () => {
    const audio = new Audio(beepUrl);
    audio.play().catch((err) => {
      console.error("Failed to play beep:", err);
    });
  };

  const handlePress = () => {
    // After 0.5s: play sound + set active true
    setTimeout(() => {
      playBeep();
      dispatch(setBlinkCalibrationActive(true));

      // After an additional 10s: play sound again + set active false
      setTimeout(() => {
        playBeep();
        dispatch(setBlinkCalibrationActive(false));
      }, 10000);
    }, 500);
  };

  return (
    <ButtonAtom
      text={t("CalibrateWideButton.select", "Calibrate — Slow Blink Sequence")}
      onClick={handlePress}
      className="text-button-color background-color-accent-neutral"
    />
  );
};

export default CalibrateSlowBlinkButtonMolecule;
