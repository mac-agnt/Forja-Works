/* Annotated front elevation of the counter, drawn from data (millimetres).
   The viewBox is in mm so every dimension line is to scale. Used by staff Jobs and the client portal. */

export interface DrawingViewProps {
  openingMm: number;
  /** previous opening, drawn as a dashed ghost with the change highlighted */
  fromMm?: number;
  widthMm?: number;
  heightMm?: number;
  title?: string;
  /** hide the highlighted callout (client view of a single revision) */
  plain?: boolean;
}

const OPEN_X = 1330; // left reveal is fixed, the opening grows to the right
const KICK = 120;
const TOP = 45;
const OPEN_BOTTOM = 560;

export default function DrawingView({ openingMm, fromMm, widthMm = 3600, heightMm = 900, title, plain }: DrawingViewProps) {
  const oEnd = OPEN_X + openingMm;
  const changed = fromMm !== undefined && fromMm !== openingMm;
  const floor = heightMm;
  const bodyBottom = floor - KICK;
  const bayA = OPEN_X / 2;
  const bayB = oEnd + (widthMm - oEnd) / 2;
  const fmt = (n: number) => n.toLocaleString("en-IE");
  const label = (title ?? "Front elevation") + ". Width " + fmt(widthMm) + " mm, height " + fmt(heightMm) + " mm, service opening " + fmt(openingMm) + " mm" + (changed ? ", changed from " + fmt(fromMm as number) + " mm" : "") + ".";

  return (
    <figure className="fj-draw">
      <svg viewBox="-380 -520 4360 1900" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        <title>{label}</title>
        {/* floor */}
        <line x1={-160} y1={floor} x2={widthMm + 160} y2={floor} className="fj-d-floor" />
        {/* kick */}
        <rect x={100} y={bodyBottom} width={widthMm - 200} height={KICK} className="fj-d-kick" />
        {/* body */}
        <rect x={0} y={TOP} width={widthMm} height={bodyBottom - TOP} className="fj-d-body" />
        {/* top slab */}
        <rect x={-40} y={0} width={widthMm + 80} height={TOP} className="fj-d-top" />
        {/* panel joints */}
        <line x1={bayA} y1={OPEN_BOTTOM + 30} x2={bayA} y2={bodyBottom} className="fj-d-joint" />
        <line x1={bayB} y1={OPEN_BOTTOM + 30} x2={bayB} y2={bodyBottom} className="fj-d-joint" />
        <line x1={0} y1={OPEN_BOTTOM + 30} x2={widthMm} y2={OPEN_BOTTOM + 30} className="fj-d-joint" />
        {/* previous opening ghost */}
        {changed && (
          <rect x={OPEN_X} y={TOP} width={fromMm as number} height={OPEN_BOTTOM - TOP} className="fj-d-ghost" />
        )}
        {/* current opening */}
        <rect x={OPEN_X} y={TOP} width={openingMm} height={OPEN_BOTTOM - TOP} className="fj-d-open" />
        {/* the strip that changed */}
        {changed && (fromMm as number) < openingMm && (
          <rect x={OPEN_X + (fromMm as number)} y={TOP} width={openingMm - (fromMm as number)} height={OPEN_BOTTOM - TOP} className="fj-d-delta" />
        )}
        <text x={OPEN_X + openingMm / 2} y={(TOP + OPEN_BOTTOM) / 2 + 24} textAnchor="middle" className="fj-d-t fj-d-t-in">Service opening</text>

        {/* opening dimension, above */}
        <Dim x1={OPEN_X} x2={oEnd} y={-110} text={fmt(openingMm)} strong />
        {changed && <Dim x1={OPEN_X} x2={OPEN_X + (fromMm as number)} y={-250} text={fmt(fromMm as number) + " before"} ghost />}
        {/* overall width, below */}
        <Dim x1={0} x2={widthMm} y={floor + 150} text={fmt(widthMm)} />
        {/* height, left */}
        <DimV y1={0} y2={floor} x={-200} text={fmt(heightMm)} />

        {/* callout */}
        {!plain && (
          <g>
            <line x1={oEnd - 60} y1={TOP + 60} x2={oEnd + 330} y2={-330} className="fj-d-lead" />
            <rect x={oEnd + 330} y={-470} width={1280} height={190} rx={34} className="fj-d-call" />
            <text x={oEnd + 330 + 640} y={-350} textAnchor="middle" className="fj-d-t fj-d-t-call">
              {changed ? "Service opening " + fromMm + " mm → " + openingMm + " mm" : "Service opening " + openingMm + " mm"}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="fj-d-cap">{title ?? "Front elevation"}, to scale. All dimensions in mm.</figcaption>
    </figure>
  );
}

function Dim({ x1, x2, y, text, strong, ghost }: { x1: number; x2: number; y: number; text: string; strong?: boolean; ghost?: boolean }) {
  const cls = "fj-d-dim" + (strong ? " fj-d-strong" : "") + (ghost ? " fj-d-faintdim" : "");
  return (
    <g className={cls}>
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 36} x2={x1} y2={y + 36} />
      <line x1={x2} y1={y - 36} x2={x2} y2={y + 36} />
      <text x={(x1 + x2) / 2} y={y - 24} textAnchor="middle" className="fj-d-t">{text}</text>
    </g>
  );
}
function DimV({ y1, y2, x, text }: { y1: number; y2: number; x: number; text: string }) {
  return (
    <g className="fj-d-dim">
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 36} y1={y1} x2={x + 36} y2={y1} />
      <line x1={x - 36} y1={y2} x2={x + 36} y2={y2} />
      <text x={x - 28} y={(y1 + y2) / 2} textAnchor="middle" transform={"rotate(-90 " + (x - 28) + " " + (y1 + y2) / 2 + ")"} className="fj-d-t">{text}</text>
    </g>
  );
}
