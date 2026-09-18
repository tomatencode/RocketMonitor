import { useMemo } from "react";

export interface LineGraphSeries {
	label: string;
	color: string;
	data: number[];
}

export interface AxisOptions {
	/** Axis title, e.g. "Time" or "Altitude". */
	label?: string;
	/** Unit suffix appended to tick labels and the axis title, e.g. "s" or "m". */
	unit?: string;
	/** Number of decimal places used for tick labels. Defaults to 0 for X and 2 for Y. */
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
	/** Uniformly scales fonts, line thickness, ticks and margins. Defaults to 1. */
	scale?: number;
	/** Absolute index of the first sample currently in `series` data. Increment this as old
	 * samples scroll out of the window so X tick marks stay aligned to the real sample index
	 * (and appear to scroll) instead of resetting to the local window position. Defaults to 0. */
	xOffset?: number;
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
	for (let v = min; v <= max + step * 0.001; v += step) ticks.push(v);
	return ticks;
}

function computeIndexTicks(offset: number, count: number, interval: number | undefined, targetTicks: number): { local: number; absolute: number }[] {
	if (count <= 0) return [];
	const step = interval && interval > 0 ? Math.round(interval) : Math.max(1, Math.round(count / targetTicks));
	const firstTick = Math.ceil(offset / step) * step;
	const ticks: { local: number; absolute: number }[] = [];
	for (let abs = firstTick; abs < offset + count; abs += step) ticks.push({ local: abs - offset, absolute: abs });
	if (ticks.length === 0) ticks.push({ local: 0, absolute: offset });
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
	scale = 1,
	xOffset = 0,
}: LineGraphProps) {
	const xLabelEvery = xAxis?.labelEvery ?? 2;
	const yLabelEvery = yAxis?.labelEvery ?? 2;
	const xShowLabels = xAxis?.showTickLabels ?? true;
	const yShowLabels = yAxis?.showTickLabels ?? true;
	const xDecimalPlaces = Math.max(0, Math.min(100, xAxis?.decimalPlaces ?? 1));
	const yDecimalPlaces = Math.max(0, Math.min(100, yAxis?.decimalPlaces ?? 1));

	const marginTop = BASE_MARGIN_TOP * scale;
	const marginRight = BASE_MARGIN_RIGHT * scale;
	const tickLength = BASE_TICK_LENGTH * scale;
	const fontSize = BASE_FONT_SIZE * scale;
	const lineStroke = BASE_LINE_STROKE * scale;
	const axisStroke = BASE_AXIS_STROKE * scale;

	const marginLeft = (20 + (yShowLabels ? 24 : 0) + (yAxis?.label ? 14 : 0)) * scale;
	// When the axis sits at Y=0, its tick labels render inside the plot, so the bottom margin
	// only needs room for the axis title (not the tick labels).
	const bottomTickSpace = xAxis?.atZero ? 0 : (xShowLabels ? 14 : 0);
	const marginBottom = (6 + bottomTickSpace + (xAxis?.label ? 14 : 0)) * scale;
	const plotWidth = WIDTH - marginLeft - marginRight;
	const plotHeight = height - marginTop - marginBottom;
	const axisX = marginLeft;
	const axisY = marginTop + plotHeight;

	const { paths, yTicks, xTicks, pointCount } = useMemo(() => {
		const trimmed = series.map(s => s.data.slice(-maxPoints));
		const finiteValues = trimmed.flat().filter(Number.isFinite);
		const autoMin = finiteValues.length ? Math.min(...finiteValues) : 0;
		const autoMax = finiteValues.length ? Math.max(...finiteValues) : 1;
		let min: number = yMin !== undefined && Number.isFinite(yMin) ? yMin : autoMin;
		let max: number = yMax !== undefined && Number.isFinite(yMax) ? yMax : autoMax;
		if (min === max) { min -= 1; max += 1; }
		const span = max - min;
		const pointCount = trimmed.reduce((longest, data) => Math.max(longest, data.length), 0);

		const toXY = (data: number[]) => {
			const count = data.length;
			if (count === 0) return "";
			const stepX = count > 1 ? plotWidth / (count - 1) : 0;
			let hasPoint = false;
			return data.flatMap((value, i) => {
					if (!Number.isFinite(value)) return [];
					const x = axisX + i * stepX;
					const y = marginTop + plotHeight - ((value - min) / span) * plotHeight;
					const command = `${hasPoint ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
					hasPoint = true;
					return [command];
				})
				.join(" ");
		};

		return {
			paths: trimmed.map(toXY),
			yTicks: computeTicks(min, max, yAxis?.tickInterval, 4),
			xTicks: computeIndexTicks(xOffset, pointCount, xAxis?.tickInterval, 5),
			pointCount,
		};
	}, [series, maxPoints, yMin, yMax, yAxis?.tickInterval, xAxis?.tickInterval, plotWidth, plotHeight, axisX, xOffset]);

	const valueToY = (value: number) => {
		const min = yTicks[0];
		const max = yTicks[yTicks.length - 1];
		const span = max - min || 1;
		return marginTop + plotHeight - ((value - min) / span) * plotHeight;
	};
	const indexToX = (index: number) => axisX + (pointCount > 1 ? (index / (pointCount - 1)) * plotWidth : 0);

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
					return (
						<g key={`y-${i}`}>
							<line x1={axisX - tickLength} y1={y} x2={axisX + tickLength} y2={y} className="stroke-zinc-600/60" strokeWidth={axisStroke} />
							{yShowLabels && i % yLabelEvery === 0 &&
							<text x={axisX - tickLength - 3 * scale} y={y} textAnchor="end" dominantBaseline="middle" fontSize={fontSize} className="fill-zinc-500">
								{value.toFixed(yDecimalPlaces)}{yAxis?.unit ?? ""}
							</text>
							}
						</g>
					);
				})}

				{/* X ticks: short marks crossing the axis, labeled every Nth. Aligned to the absolute
				   sample index (via xOffset) so they scroll with the data instead of the window. */}
				{xTicks.map((tick, i) => {
					const x = indexToX(tick.local);
					return (
						<g key={`x-${tick.absolute}`}>
							<line x1={x} y1={xAxisY - tickLength} x2={x} y2={xAxisY + tickLength} className="stroke-zinc-600/60" strokeWidth={axisStroke} />
							{xShowLabels && i % xLabelEvery === 0 &&
							<text x={x} y={xAxisY + tickLength + 9 * scale} textAnchor="middle" fontSize={fontSize} className="fill-zinc-500">
								{tick.absolute.toFixed(xDecimalPlaces)}{xAxis?.unit ?? ""}
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

