import { useMemo, useRef, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { List, TrendingDown, TrendingUp } from "lucide-react";
import type { CreditTransaction } from "../../../domain/models";
import { Segmented } from "../../../presentation/ui";

type RangeDays = "7" | "30" | "90";

type DayBucket = { date: string; earned: number; spent: number };

const VIEW_W = 720;
const VIEW_H = 200;
const BASE_Y = VIEW_H / 2;
const USABLE_HALF = BASE_Y - 12;
const BAR_RADIUS = 4;

const roundedBarPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  roundTop: boolean,
) => {
  if (height <= 0.5) return "";
  const r = Math.min(BAR_RADIUS, width / 2, height);
  return roundTop
    ? `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
    : `M${x},${y} L${x + width},${y} L${x + width},${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} L${x + r},${y + height} Q${x},${y + height} ${x},${y + height - r} Z`;
};

const buildDays = (
  transactions: CreditTransaction[],
  rangeDays: number,
): DayBucket[] => {
  const buckets = new Map<string, DayBucket>();
  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const date = format(subDays(new Date(), i), "yyyy-MM-dd");
    buckets.set(date, { date, earned: 0, spent: 0 });
  }
  for (const tx of transactions) {
    const bucket = buckets.get(tx.createdAt.slice(0, 10));
    if (!bucket) continue;
    if (tx.balanceDelta > 0) bucket.earned += tx.balanceDelta;
    else if (tx.balanceDelta < 0) bucket.spent += Math.abs(tx.balanceDelta);
  }
  return Array.from(buckets.values());
};

export function CreditUsageChart({
  transactions,
  loading,
  range,
  onRangeChange,
}: {
  transactions: CreditTransaction[];
  loading: boolean;
  range: RangeDays;
  onRangeChange: (range: RangeDays) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number>();
  const [showTable, setShowTable] = useState(false);
  const days = useMemo(
    () => buildDays(transactions, Number(range)),
    [transactions, range],
  );
  const totals = useMemo(
    () =>
      days.reduce(
        (sum, day) => ({
          earned: sum.earned + day.earned,
          spent: sum.spent + day.spent,
        }),
        { earned: 0, spent: 0 },
      ),
    [days],
  );
  const maxValue = Math.max(
    1,
    ...days.map((day) => Math.max(day.earned, day.spent)),
  );
  const barSlot = VIEW_W / Math.max(days.length, 1);
  const barWidth = Math.max(1, Math.min(24, barSlot - 2));

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || !days.length) return;
    const rect = svg.getBoundingClientRect();
    const localX = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const index = Math.min(
      days.length - 1,
      Math.max(0, Math.floor(localX / barSlot)),
    );
    setHoverIndex(index);
  };

  const hovered = hoverIndex !== undefined ? days[hoverIndex] : undefined;

  return (
    <div className="credit-usage-chart">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="creditusage-swatch creditusage-swatch--earned" />
            <span className="text-muted">Recebidos</span>
            <b>{totals.earned}</b>
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="creditusage-swatch creditusage-swatch--spent" />
            <span className="text-muted">Consumidos</span>
            <b>{totals.spent}</b>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Segmented<RangeDays>
            value={range}
            onChange={onRangeChange}
            items={[
              { value: "7", label: "7 dias" },
              { value: "30", label: "30 dias" },
              { value: "90", label: "90 dias" },
            ]}
          />
          <button
            type="button"
            onClick={() => setShowTable((value) => !value)}
            className="icon-button"
            aria-label={showTable ? "Ver gráfico" : "Ver como tabela"}
            title={showTable ? "Ver gráfico" : "Ver como tabela"}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-app-muted">
          Carregando uso de créditos…
        </div>
      ) : !totals.earned && !totals.spent ? (
        <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center text-sm text-app-muted">
          <TrendingUp size={20} className="opacity-50" />
          Nenhuma movimentação de créditos neste período.
        </div>
      ) : showTable ? (
        <div className="max-h-[220px] overflow-y-auto rounded-xl border border-app-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-app-elevated text-[10px] font-bold uppercase text-app-muted">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Recebidos</th>
                <th className="px-3 py-2">Consumidos</th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((day) => day.earned || day.spent)
                .slice()
                .reverse()
                .map((day) => (
                  <tr key={day.date} className="border-t border-app-border">
                    <td className="px-3 py-2">
                      {format(parseISO(day.date), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {day.earned ? `+${day.earned}` : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {day.spent ? `-${day.spent}` : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="block w-full"
            style={{ height: "auto" }}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIndex(undefined)}
            role="img"
            aria-label="Créditos recebidos e consumidos por dia"
          >
            <line
              x1={0}
              y1={BASE_Y}
              x2={VIEW_W}
              y2={BASE_Y}
              className="creditusage-baseline"
            />
            {days.map((day, index) => {
              const x = index * barSlot + (barSlot - barWidth) / 2;
              const earnedHeight = (day.earned / maxValue) * USABLE_HALF;
              const spentHeight = (day.spent / maxValue) * USABLE_HALF;
              const isHovered = hoverIndex === index;
              return (
                <g key={day.date} opacity={isHovered ? 1 : 0.92}>
                  {isHovered && (
                    <rect
                      x={index * barSlot}
                      y={0}
                      width={barSlot}
                      height={VIEW_H}
                      className="creditusage-hover-col"
                    />
                  )}
                  {day.earned > 0 && (
                    <path
                      d={roundedBarPath(
                        x,
                        BASE_Y - earnedHeight,
                        barWidth,
                        earnedHeight,
                        true,
                      )}
                      className="creditusage-bar creditusage-bar--earned"
                    />
                  )}
                  {day.spent > 0 && (
                    <path
                      d={roundedBarPath(x, BASE_Y, barWidth, spentHeight, false)}
                      className="creditusage-bar creditusage-bar--spent"
                    />
                  )}
                </g>
              );
            })}
          </svg>
          {hovered && (
            <div
              className="creditusage-tooltip"
              style={{
                left: `${((hoverIndex! + 0.5) / days.length) * 100}%`,
              }}
            >
              <b>
                {format(parseISO(hovered.date), "dd 'de' MMM", { locale: ptBR })}
              </b>
              <span className="creditusage-tooltip-row">
                <TrendingUp size={12} className="creditusage-ink-earned" />
                Recebidos <b>{hovered.earned}</b>
              </span>
              <span className="creditusage-tooltip-row">
                <TrendingDown size={12} className="creditusage-ink-spent" />
                Consumidos <b>{hovered.spent}</b>
              </span>
            </div>
          )}
          <div className="text-muted mt-2 flex justify-between text-[10px]">
            <span>
              {format(parseISO(days[0].date), "dd/MM", { locale: ptBR })}
            </span>
            <span>
              {format(parseISO(days[days.length - 1].date), "dd/MM", {
                locale: ptBR,
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
