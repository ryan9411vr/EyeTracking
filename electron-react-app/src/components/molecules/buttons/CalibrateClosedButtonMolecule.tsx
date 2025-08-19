// src/components/molecules/buttons/CalibrateClosedButtonMolecule.tsx

/**
 * CalibrateClosedButtonMolecule
 *
 * Momentary button that flags the Redux field `closedCalibrationActive` while
 * pressed.  Uses the PressableButtonAtom so we can independently handle the
 * press (pointer‑down) and release (pointer‑up) lifecycle events.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { setClosedCalibrationActive } from "../../../slices/statusSlice";
import ButtonAtom from "../../atoms/ButtonAtom";
import beepUrl from "../../../../public/beep.mp3";

const CalibrateClosedButtonMolecule: React.FC = () => {
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
      dispatch(setClosedCalibrationActive(true));

      // After an additional 5s: play sound again + set active false
      setTimeout(() => {
        playBeep();
        dispatch(setClosedCalibrationActive(false));
      }, 5000);
    }, 500);
  };

  return (
    <ButtonAtom
      text={t("CalibrateClosedButton.select")}
      onClick={handlePress}
      className="text-button-color background-color-accent-neutral"
    />
  );
};

export default CalibrateClosedButtonMolecule;