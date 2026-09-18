import { useMemo } from "react";

/** A single sample: either a bare value (plotted at an index-derived X) or an explicit {x, y} pair for irregular intervals. */
export type LineGraphPoint = number | { x: number; y: number };

export interface LineGraphSeries {
	label: string;
	color: string;
	data: LineGraphPoint[];
}

export interface AxisOptions {
	/** Axis title, e.g. "Time" or "Altitude". */
	label?: string;
	/** Unit suffix appended to tick labels and the axis title, e.g. "s" or "m". */
	unit?: string;
	/** Number of decimal places used for tick labels. Defaults to 1. */
	decimalPlaces?: number;
	/** Spacing between ticks, in data units (index step for X, value step for Y). Auto-computed if omitted. */
	tickInterval?: number;
	/** Whether to render numeric labels on ticks. Defaults to true. */
	showTickLabels?: boolean;
	/** Only label every Nth tick (the rest still render as unlabeled tick marks). Defaults to 2. */
	labelEvery?: number;
	/** X axis only: render the axis line/ticks at the Y=0 value instead of at the bottom of the plot. */
	atZero?: boolean;
}

interface LineGraphProps {
	series: LineGraphSeries[];
	height?: number;
	className?: string;
	maxPoints?: number;
	showLegend?: boolean;
	xAxis?: AxisOptions;
	yAxis?: AxisOptions;
	/** Fixed Y axis bounds. Falls back to auto-scaling from the visible data when omitted. */
	yMin?: number;
	yMax?: number;
	/** Minimum Y value used for auto-scaling when `yMin` is not specified. */
	yAutoscaleMin?: number;
	yAutoscaleMax?: number;
	/** Uniformly scales fonts, line thickness, ticks and margins. Defaults to 1. */
	scale?: number;
	/** Absolute index of the first sample currently in `series` data. Increment this as old
	 * samples scroll out of the window so X tick marks stay aligned to the real sample index
	 * (and appear to scroll) instead of resetting to the local window position. Defaults to 0.
	 * Only applies to plain-number samples; {x, y} samples carry their own absolute X already. */
	xOffset?: number;
	/** Width of the visible X window, in data units. When set, only samples whose x falls within
	 * [xMax - maxXinFrame, xMax] are shown, so the window is defined by a span of X (e.g. time)
	 * rather than by a fixed sample count - correct even when samples arrive at irregular intervals. */
	maxXinFrame?: number;
}

type Point = { x: number; y: number };

function toPoint(sample: LineGraphPoint, index: number, xOffset: number): Point {
	return typeof sample === "number" ? { x: xOffset + index, y: sample } : sample;
}

/** Min/max over a flat array via a single reduce pass - avoids Math.max(...arr)/Math.min(...arr),
 * which risk a stack overflow on large arrays. Returns `fallback` when `values` is empty. */
function minMax(values: number[], fallback: number): [min: number, max: number] {
	if (values.length === 0) return [fallback, fallback];
	let min = values[0];
	let max = values[0];
	for (const v of values) {
		if (v < min) min = v;
		if (v > max) max = v;
	}
	return [min, max];
}

/** Converts each series' raw samples to sorted, absolute {x, y} points, most recent `maxPoints` only. */
function toAbsolutePoints(series: LineGraphSeries[], maxPoints: number, xOffset: number): Point[][] {
	return series.map(s =>
		s.data.slice(-maxPoints).map((sample, i) => toPoint(sample, i, xOffset)).sort((a, b) => a.x - b.x)
	);
}

/** Keeps only points whose x falls within the trailing `maxXinFrame` window of the latest x across all series. */
function clipToWindow(pointsPerSeries: Point[][], maxXinFrame: number | undefined): Point[][] {
	if (maxXinFrame === undefined) return pointsPerSeries;
	const allX = pointsPerSeries.flatMap(points => points.map(p => p.x)).filter(Number.isFinite);
	if (allX.length === 0) return pointsPerSeries;
	const [, latestX] = minMax(allX, 0);
	const cutoff = latestX - maxXinFrame;
	return pointsPerSeries.map(points => points.filter(p => p.x >= cutoff));
}

/** Builds an SVG path "d" string for one series' points, mapped into plot pixel space. Skips non-finite samples. */
function buildPath(points: Point[], xMin: number, xSpan: number, yMin: number, ySpan: number, plot: { axisX: number; marginTop: number; plotWidth: number; plotHeight: number }): string {
	let hasPoint = false;
	const commands: string[] = [];
	for (const { x: px, y: value } of points) {
		if (!Number.isFinite(value) || !Number.isFinite(px)) continue;
		const x = plot.axisX + ((px - xMin) / xSpan) * plot.plotWidth;
		const y = plot.marginTop + plot.plotHeight - ((value - yMin) / ySpan) * plot.plotHeight;
		commands.push(`${hasPoint ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`);
		hasPoint = true;
	}
	return commands.join(" ");
}

/** Rough glyph width estimate for the (monospace-ish) tick label font, used to reserve just enough
 * left margin that Y tick labels never collide with the axis title. Slightly generous by design. */
function estimateTextWidth(text: string, fontSize: number): number {
	return text.length * fontSize * 0.62;
}

const WIDTH = 400;
const BASE_MARGIN_TOP = 8;
const BASE_MARGIN_RIGHT = 8;
const BASE_TICK_LENGTH = 4;
const BASE_FONT_SIZE = 9;
const BASE_LINE_STROKE = 1.5;
const BASE_AXIS_STROKE = 1;

function niceStep(span: number, targetTicks: number): number {
	if (span <= 0) return 1;
	return span / targetTicks;
}

function computeTicks(min: number, max: number, interval: number | undefined, targetTicks: number): number[] {
	const step = interval && interval > 0 ? interval : niceStep(max - min, targetTicks);
	const ticks: number[] = [];
	const firstTick = Math.floor(min / step) * step;
	const lastTick = Math.ceil(max / step) * step;
	for (let v = firstTick; v <= lastTick + step * 0.001; v += step) {
		ticks.push(Number(v.toFixed(10)));
	}
	return ticks;
}

export function LineGraph({
	series,
	height = 160,
	className = "",
	maxPoints = 200,
	showLegend = true,
	xAxis,
	yAxis,
	yMin,
	yMax,
	yAutoscaleMin,
	yAutoscaleMax,
	scale = 1,
	xOffset = 0,
	maxXinFrame,
}: LineGraphProps) {
	const xLabelEvery = Math.max(1, xAxis?.labelEvery ?? 2);
	const yLabelEvery = Math.max(1, yAxis?.labelEvery ?? 2);
	const xShowLabels = xAxis?.showTickLabels ?? false;
	const yShowLabels = yAxis?.showTickLabels ?? true;
	const xDecimalPlaces = Math.max(0, Math.min(100, xAxis?.decimalPlaces ?? 1));
	const yDecimalPlaces = Math.max(0, Math.min(100, yAxis?.decimalPlaces ?? 1));

	const marginTop = BASE_MARGIN_TOP * scale;
	const marginRight = BASE_MARGIN_RIGHT * scale;
	const tickLength = BASE_TICK_LENGTH * scale;
	const fontSize = BASE_FONT_SIZE * scale;
	const lineStroke = BASE_LINE_STROKE * scale;
	const axisStroke = BASE_AXIS_STROKE * scale;

	const { pointsPerSeries, yLo, ySpan, xMin, xSpan, yTicks, xTicks } = useMemo(() => {
		const pointsPerSeries = clipToWindow(toAbsolutePoints(series, maxPoints, xOffset), maxXinFrame);
		const allPoints = pointsPerSeries.flat();

		const finiteYs = allPoints.map(p => p.y).filter(Number.isFinite);
		const [autoMin, autoMax] = minMax(finiteYs, 0);
		const autoBoundedMin = Math.min(autoMin, yAutoscaleMin ?? 0);
		const autoBoundedMax = Math.max(autoMax, yAutoscaleMax ?? 0);
		let yLo = yMin !== undefined && Number.isFinite(yMin) ? yMin : autoBoundedMin;
		let yHi = yMax !== undefined && Number.isFinite(yMax) ? yMax : autoBoundedMax;
		if (yMin === undefined && yLo > 0) yLo = 0;
		if (yMax === undefined && yHi < 0) yHi = 0;
		if (yLo === yHi) { yLo -= 1; yHi += 1; }
		const ySpan = yHi - yLo;

		const finiteXs = allPoints.map(p => p.x).filter(Number.isFinite);
		const [xMin, xMax] = finiteXs.length ? minMax(finiteXs, xOffset) : [xOffset, xOffset];
		const xSpan = xMax - xMin || 1;

		// Drop ticks computeTicks rounded outside the real domain so they don't render past the axis.
		const xTickTolerance = xSpan * 1e-6;
		return {
			pointsPerSeries,
			yLo,
			ySpan,
			xMin,
			xSpan,
			yTicks: computeTicks(yLo, yHi, yAxis?.tickInterval, 4),
			xTicks: computeTicks(xMin, xMax, xAxis?.tickInterval, 5).filter(t => t >= xMin - xTickTolerance && t <= xMax + xTickTolerance),
		};
	}, [series, maxPoints, yMin, yMax, yAutoscaleMin, yAutoscaleMax, yAxis?.tickInterval, xAxis?.tickInterval, xOffset, maxXinFrame]);

	// Reserve exactly as much left margin as the widest rendered Y tick label needs, so the axis
	// title (fixed just left of that column) never overlaps long labels (e.g. negative decimals + unit).
	const yTickLabelWidth = yShowLabels
		? yTicks.reduce((widest, v) => Math.max(widest, estimateTextWidth(`${v.toFixed(yDecimalPlaces)}${yAxis?.unit ?? ""}`, fontSize)), 0)
		: 0;

	const marginLeft = 20 * scale + yTickLabelWidth + (yAxis?.label ? 14 * scale : 0);
	// When the axis sits at Y=0, its tick labels render inside the plot, so the bottom margin
	// only needs room for the axis title (not the tick labels).
	const bottomTickSpace = xAxis?.atZero ? 0 : (xShowLabels ? 14 : 0);
	const marginBottom = (6 + bottomTickSpace + (xAxis?.label ? 14 : 0)) * scale;
	const plotWidth = WIDTH - marginLeft - marginRight;
	const plotHeight = height - marginTop - marginBottom;
	const axisX = marginLeft;
	const axisY = marginTop + plotHeight;

	const paths = useMemo(
		() => pointsPerSeries.map(points => buildPath(points, xMin, xSpan, yLo, ySpan, { axisX, marginTop, plotWidth, plotHeight })),
		[pointsPerSeries, xMin, xSpan, yLo, ySpan, axisX, marginTop, plotWidth, plotHeight]
	);

	const valueToY = (value: number) => {
		const min = yTicks[0];
		const max = yTicks[yTicks.length - 1];
		const span = max - min || 1;
		return marginTop + plotHeight - ((value - min) / span) * plotHeight;
	};
	const indexToX = (value: number) => axisX + (plotWidth * (value - xMin)) / xSpan;

	const xAxisY = xAxis?.atZero ? Math.min(Math.max(valueToY(0), marginTop), axisY) : axisY;

	return (
		<div className={`flex flex-col gap-1 ${className}`}>
			<svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="bg-transparent">
				{/* axis lines */}
				<line x1={axisX} y1={marginTop} x2={axisX} y2={axisY} className="stroke-zinc-600/60" strokeWidth={axisStroke} />
				<line x1={axisX} y1={xAxisY} x2={WIDTH - marginRight} y2={xAxisY} className="stroke-zinc-600/60" strokeWidth={axisStroke} />

				{/* Y ticks: short marks crossing the axis, labeled every Nth */}
				{yTicks.map((value, i) => {
					const y = valueToY(value);
					const zeroTickIndex = yTicks.findIndex(tick => tick === 0);
					const isRegularLabel = zeroTickIndex >= 0
						? (i - zeroTickIndex) % yLabelEvery === 0
						: i % yLabelEvery === 0;
					return (
						<g key={`y-${i}`}>
							<line x1={axisX - tickLength} y1={y} x2={axisX + tickLength} y2={y} className="stroke-zinc-600/60" strokeWidth={axisStroke} />
							{yShowLabels && isRegularLabel &&
							<text x={axisX - tickLength - 3 * scale} y={y} textAnchor="end" dominantBaseline="middle" fontSize={fontSize} className="fill-zinc-500">
								{value.toFixed(yDecimalPlaces)}{yAxis?.unit ?? ""}
							</text>
							}
						</g>
					);
				})}

				{/* X ticks: short marks crossing the axis, labeled every Nth. Positioned by real X value
				   (absolute sample index, or explicit {x,y} coordinate) so irregular intervals render correctly
				   and ticks scroll with the data instead of the window. */}
				{xTicks.map((value, i) => {
					const x = indexToX(value);
					const isRegularLabel = i % xLabelEvery === 0;
					return (
						<g key={`x-${value}`}>
							<line x1={x} y1={xAxisY - tickLength} x2={x} y2={xAxisY + tickLength} className="stroke-zinc-600/60" strokeWidth={axisStroke} />
							{xShowLabels && isRegularLabel &&
							<text x={x} y={xAxisY + tickLength + 9 * scale} textAnchor="middle" fontSize={fontSize} className="fill-zinc-500">
								{value.toFixed(xDecimalPlaces)}{xAxis?.unit ?? ""}
							</text>
							}
						</g>
					);
				})}

				{/* axis titles */}
				{yAxis?.label &&
				<text x={10 * scale} y={marginTop + plotHeight / 2} textAnchor="middle" fontSize={fontSize} className="fill-zinc-400" transform={`rotate(-90, ${10 * scale}, ${marginTop + plotHeight / 2})`}>
					{yAxis.label}{yAxis.unit ? ` (${yAxis.unit})` : ""}
				</text>
				}
				{xAxis?.label &&
				<text x={axisX + plotWidth / 2} y={axisY + bottomTickSpace * scale + 12 * scale} textAnchor="middle" fontSize={fontSize} className="fill-zinc-400">
					{xAxis.label}{xAxis.unit ? ` (${xAxis.unit})` : ""}
				</text>
				}

				{series.map((s, i) => (
					<path key={s.label + i} d={paths[i]} fill="none" stroke={s.color} strokeWidth={lineStroke} strokeLinejoin="round" strokeLinecap="round" />
				))}
			</svg>
			{showLegend && series.length > 0 &&
			<div className="flex flex-wrap gap-x-3 gap-y-1" style={{ fontSize: 10 * scale }}>
				{series.map((s, i) => (
					<span key={s.label + i} className="flex items-center gap-1 text-zinc-400">
						<span className="inline-block rounded-sm" style={{ backgroundColor: s.color, width: 8 * scale, height: 8 * scale }} />
						{s.label}
					</span>
				))}
			</div>
			}
		</div>
	);
}

