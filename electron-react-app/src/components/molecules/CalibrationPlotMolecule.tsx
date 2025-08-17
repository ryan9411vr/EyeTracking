import React, { useCallback, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { RootState } from "../../store";

type Series = number[] | null | undefined;

const WIDTH_MIN = 800;
const WIDTH_MAX = 1800;
const HEIGHT = 260;

function drawBlinkPlot(
  canvas: HTMLCanvasElement,
  pred: number[],
  opts?: { smooth?: number[]; openTh?: number; closeTh?: number }
) {
  const width = Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, pred.length));
  const height = HEIGHT;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, height - 30);
  ctx.lineTo(width - 10, height - 30);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(40, 10);
  ctx.lineTo(40, height - 30);
  ctx.stroke();

  const left = 40, right = width - 10, top = 10, bottom = height - 30;
  const W = right - left, H = bottom - top;
  const xOf = (i: number) => left + (i / (pred.length - 1)) * W;
  const yOf = (v: number) => bottom - Math.max(0, Math.min(1, v)) * H;

  if (opts?.openTh !== undefined) {
    ctx.strokeStyle = "#5c9ded";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(left, yOf(opts.openTh));
    ctx.lineTo(right, yOf(opts.openTh));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (opts?.closeTh !== undefined) {
    ctx.strokeStyle = "#ed6e5c";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(left, yOf(opts.closeTh));
    ctx.lineTo(right, yOf(opts.closeTh));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (opts?.smooth && opts.smooth.length > 0) {
    const len = Math.min(opts.smooth.length, pred.length);
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(opts.smooth[0]));
    for (let i = 1; i < len; i++) ctx.lineTo(xOf(i), yOf(opts.smooth[i]));
    ctx.stroke();
  }

  ctx.strokeStyle = "#0fe36d";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(pred[0]));
  for (let i = 1; i < pred.length; i++) ctx.lineTo(xOf(i), yOf(pred[i]));
  ctx.stroke();

  ctx.fillStyle = "#ccc";
  ctx.font = "12px system-ui, sans-serif";
  [0, 0.5, 1].forEach((v) => {
    ctx.fillText(String(v), 8, yOf(v) + 4);
  });
}

const PlotCanvas: React.FC<{
  title: string;
  pred: Series;
  smooth?: Series;
  openTh?: number;
  closeTh?: number;
}> = ({ title, pred, smooth, openTh, closeTh }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  const draw = useCallback(() => {
    if (!ref.current || !pred || pred.length < 2) return;
    drawBlinkPlot(ref.current, pred, {
      smooth: smooth && smooth.length ? smooth : undefined,
      openTh,
      closeTh,
    });
  }, [pred, smooth, openTh, closeTh]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (ref.current?.parentElement) ro.observe(ref.current.parentElement);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <div className="calibration-plot">
      <div className="card-header text-header-color text-header">
        {title}
        {!pred || pred.length < 2 ? (
          <div className="text-danger-color text-tiny">No data</div>
        ) : null}
      </div>
      <canvas
        ref={ref}
        style={{
          width: "100%",
          height: `${HEIGHT}px`,
          background: "#111",
          border: "1px solid #444",
        }}
      />
    </div>
  );
};

const CalibrationPlotMolecule: React.FC = () => {
  const { t } = useTranslation();

  const enabled = useSelector((s: RootState) => s.config.calibrationPlotEnabled);
  const expanded = useSelector((s: RootState) => s.config.calibrationPlotExpanded);

  const openTh = useSelector((s: RootState) => s.config.blinkOpenThreshold);
  const closeTh = useSelector((s: RootState) => s.config.blinkCloseThreshold);

  const predCombined = useSelector((s: RootState) => s.config.calibrationPlotData.combined);
  const predLeft = useSelector((s: RootState) => s.config.calibrationPlotData.left);
  const predRight = useSelector((s: RootState) => s.config.calibrationPlotData.right);

  const smoothCombined = useSelector((s: RootState) => s.config.calibrationPlotData.smoothCombined);
  const smoothLeft = useSelector((s: RootState) => s.config.calibrationPlotData.smoothLeft);
  const smoothRight = useSelector((s: RootState) => s.config.calibrationPlotData.smoothRight);

  if (!enabled || !expanded) return null;

  return (
    <div className="card-body mt-1">
      <PlotCanvas
        title={t("CalibrationPlotCard.combined")}
        pred={predCombined}
        smooth={smoothCombined}
        openTh={openTh}
        closeTh={closeTh}
      />
      <div className="mb-1" />
      <PlotCanvas
        title={t("CalibrationPlotCard.leftEye")}
        pred={predLeft}
        smooth={smoothLeft}
        openTh={openTh}
        closeTh={closeTh}
      />
      <div className="mb-1" />
      <PlotCanvas
        title={t("CalibrationPlotCard.rightEye")}
        pred={predRight}
        smooth={smoothRight}
        openTh={openTh}
        closeTh={closeTh}
      />
    </div>
  );
};

export default CalibrationPlotMolecule;
