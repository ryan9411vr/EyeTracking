// src/components/molecules/TrackingDataMolecule.tsx
import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useTranslation } from 'react-i18next';

const SVG_SIZE = 200;
const CENTER = SVG_SIZE / 2;
const GAUGE_RADIUS = 80;
const MAX_ANGLE = 45;

const computeDotPos = (
  pitch: number,
  yaw: number,
  center: number,
  gaugeRadius: number,
  maxAngle: number
) => {
  const dotX = center + (yaw / maxAngle) * gaugeRadius;
  const dotY = center - (pitch / maxAngle) * gaugeRadius;
  return { dotX, dotY };
};

interface GaugeProps {
  pos: { dotX: number; dotY: number };
  yaw: number;
  adjustedPitch: number;
  svgSize?: number;
  gaugeRadius?: number;
  center?: number;
}

const Gauge: React.FC<GaugeProps> = ({
  pos,
  yaw,
  adjustedPitch,
  svgSize = SVG_SIZE,
  gaugeRadius = GAUGE_RADIUS,
  center = CENTER,
}) => {
  const { t } = useTranslation();
  return (
    <div className="text-center">
      <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        {/* Outer circular gauge */}
        <circle
          cx={center}
          cy={center}
          r={gaugeRadius}
          stroke="var(--color-gauge-outline)"
          fill="none"
          strokeWidth="2"
        />
        {/* Crosshair lines */}
        <line
          x1={center}
          y1={center - gaugeRadius}
          x2={center}
          y2={center + gaugeRadius}
          stroke="var(--application-background-level-3-light)"
          strokeWidth="1"
        />
        <line
          x1={center - gaugeRadius}
          y1={center}
          x2={center + gaugeRadius}
          y2={center}
          stroke="var(--application-background-level-3-light)"
          strokeWidth="1"
        />
        {/* Dot indicating pitch and yaw */}
        <circle cx={pos.dotX} cy={pos.dotY} r="6" fill="var(--color-slider-dot)" />
      </svg>
      <div className="text-mono text-center">
        {t('TrackingDataCard.gaugeLabel', { yaw: yaw.toFixed(2), pitch: adjustedPitch.toFixed(2) })}
      </div>
    </div>
  );
};

const getSingleGaugeData = (
  statusState: RootState['status'],
  pitchOffset: number,
  independentEyes: boolean,
  leftEyeStatus: string,
  rightEyeStatus: string
) => {
  let pitch = 0;
  let yaw = 0;
  if (!independentEyes) {
    if (leftEyeStatus === 'online' && rightEyeStatus === 'online') {
      pitch = -1 * (statusState.latents.theta1 || 0);
      yaw = statusState.latents.theta2 || 0;
    } else if (leftEyeStatus === 'online' && rightEyeStatus !== 'online') {
      pitch = -1 * (statusState.latentsLeft.theta1 || 0);
      yaw = statusState.latentsLeft.theta2 || 0;
    } else if (leftEyeStatus !== 'online' && rightEyeStatus === 'online') {
      pitch = -1 * (statusState.latentsRight.theta1 || 0);
      yaw = statusState.latentsRight.theta2 || 0;
    }
  } else {
    if (leftEyeStatus === 'online' && rightEyeStatus !== 'online') {
      pitch = -1 * (statusState.latentsLeft.theta1 || 0);
      yaw = statusState.latentsLeft.theta2 || 0;
    } else if (rightEyeStatus === 'online' && leftEyeStatus !== 'online') {
      pitch = -1 * (statusState.latentsRight.theta1 || 0);
      yaw = statusState.latentsRight.theta2 || 0;
    }
  }
  const adjustedPitch = pitch + pitchOffset;
  const pos = computeDotPos(adjustedPitch, yaw, CENTER, GAUGE_RADIUS, MAX_ANGLE);
  return { pitch, yaw, adjustedPitch, pos };
};

const TrackingDataMolecule: React.FC = () => {
  const statusState = useSelector((state: RootState) => state.status);
  const { pitchOffset, independentEyes } = useSelector((state: RootState) => state.config);
  const leftEyeStatus = useSelector((state: RootState) => state.status.imageData.leftEye.status);
  const rightEyeStatus = useSelector((state: RootState) => state.status.imageData.rightEye.status);

  const dualDisplay = independentEyes && leftEyeStatus === 'online' && rightEyeStatus === 'online';

  if (dualDisplay) {
    // Compute left eye gauge data.
    const leftPitch = -1 * (statusState.latentsLeft.theta1 || 0);
    const leftYaw = statusState.latentsLeft.theta2 || 0;
    const leftAdjustedPitch = leftPitch + pitchOffset;
    const leftPos = computeDotPos(leftAdjustedPitch, leftYaw, CENTER, GAUGE_RADIUS, MAX_ANGLE);

    // Compute right eye gauge data.
    const rightPitch = -1 * (statusState.latentsRight.theta1 || 0);
    const rightYaw = statusState.latentsRight.theta2 || 0;
    const rightAdjustedPitch = rightPitch + pitchOffset;
    const rightPos = computeDotPos(rightAdjustedPitch, rightYaw, CENTER, GAUGE_RADIUS, MAX_ANGLE);

    return (
      <div className="tracking-gauges-row">
        <Gauge pos={leftPos} yaw={leftYaw} adjustedPitch={leftAdjustedPitch} />
        <Gauge pos={rightPos} yaw={rightYaw} adjustedPitch={rightAdjustedPitch} />
      </div>
    );
  } else {
    // Single display mode.
    const { yaw, adjustedPitch, pos } = getSingleGaugeData(
      statusState,
      pitchOffset,
      independentEyes,
      leftEyeStatus,
      rightEyeStatus
    );
    return (
      <div className="tracking-gauges-column">
        <Gauge pos={pos} yaw={yaw} adjustedPitch={adjustedPitch} />
      </div>
    );
  }
};

export default TrackingDataMolecule;
