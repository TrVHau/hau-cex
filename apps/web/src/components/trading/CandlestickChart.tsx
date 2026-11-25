import { useMemo, useState, useRef } from 'react';
import { useKlines, useRecentTrades } from '../../hooks/useApi';
import { formatPrice } from '../../lib/utils';

interface CandlestickChartProps {
  symbol: string;
  timeframe: '1M' | '5M' | '15M' | '1H' | '4H' | '1D' | '1W';
  currentPrice: string;
  tickSize?: string;
}

interface FormattedCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function CandlestickChart({
  symbol,
  timeframe,
  currentPrice,
  tickSize = '0.01',
}: CandlestickChartProps) {
  const { data: rawKlines = [] } = useKlines(symbol, timeframe.toLowerCase());
  const { data: recentTrades = [] } = useRecentTrades(symbol);

  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Timeframe interval in milliseconds
  const intervalMs = useMemo(() => {
    const map: Record<string, number> = {
      '1M': 60 * 1000,
      '5M': 5 * 60 * 1000,
      '15M': 15 * 60 * 1000,
      '1H': 60 * 60 * 1000,
      '4H': 4 * 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000,
      '1W': 7 * 24 * 60 * 60 * 1000,
    };
    return map[timeframe] || 15 * 60 * 1000;
  }, [timeframe]);

  // Merge raw klines with recent live trades into reactive candlestick series
  const candles = useMemo<FormattedCandle[]>(() => {
    if (!rawKlines || rawKlines.length === 0) {
      // Fallback baseline around current price
      const base = parseFloat(currentPrice) || 60000;
      const arr: FormattedCandle[] = [];
      const now = Date.now();
      let prev = base;
      for (let i = 24; i >= 0; i--) {
        const t = Math.floor((now - i * intervalMs) / intervalMs) * intervalMs;
        const drift = Math.sin(i * 0.4) * 20;
        const open = prev;
        const close = open + drift;
        arr.push({
          time: t,
          open,
          high: Math.max(open, close) + 15,
          low: Math.min(open, close) - 15,
          close,
          volume: 0.25,
        });
        prev = close;
      }
      return arr;
    }

    const list: FormattedCandle[] = rawKlines.map((k) => ({
      time: k.time,
      open: parseFloat(k.open),
      high: parseFloat(k.high),
      low: parseFloat(k.low),
      close: parseFloat(k.close),
      volume: parseFloat(k.volume),
    }));

    // If we have live recent trades, update the latest candle in real-time
    if (recentTrades.length > 0 && list.length > 0) {
      const latestTrade = recentTrades[0];
      const tradePrice = parseFloat(latestTrade.price);
      const tradeTime = new Date(latestTrade.createdAt).getTime();

      const lastCandle = list[list.length - 1];
      const isWithinLastCandle = tradeTime >= lastCandle.time;

      if (isWithinLastCandle && !isNaN(tradePrice) && tradePrice > 0) {
        lastCandle.close = tradePrice;
        lastCandle.high = Math.max(lastCandle.high, tradePrice);
        lastCandle.low = Math.min(lastCandle.low, tradePrice);
      }
    }

    // Ensure continuous open-close alignment across candles
    for (let i = 1; i < list.length; i++) {
      list[i].open = list[i - 1].close;
      list[i].high = Math.max(list[i].high, list[i].open, list[i].close);
      list[i].low = Math.min(list[i].low, list[i].open, list[i].close);
    }

    return list;
  }, [rawKlines, recentTrades, currentPrice, intervalMs]);

  // Compute Moving Averages
  const { ma7, ma25 } = useMemo(() => {
    const calcMA = (period: number) => {
      return candles.map((_, i) => {
        if (i < period - 1) return null;
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += candles[i - j].close;
        }
        return sum / period;
      });
    };
    return {
      ma7: calcMA(7),
      ma25: calcMA(25),
    };
  }, [candles]);

  // Chart dimensions & scaling
  const width = 760;
  const height = 230;
  const paddingLeft = 10;
  const paddingRight = 65; // space for Y-axis price labels
  const paddingTop = 20;
  const paddingBottom = 25; // space for X-axis time labels

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const { minPrice, maxPrice, priceStep } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 59000, maxPrice: 61000, priceStep: 500 };
    let min = Infinity;
    let max = -Infinity;
    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    const padding = (max - min) * 0.12 || 50;
    const paddedMin = Math.floor((min - padding) / 10) * 10;
    const paddedMax = Math.ceil((max + padding) / 10) * 10;
    const step = (paddedMax - paddedMin) / 4;
    return { minPrice: paddedMin, maxPrice: paddedMax, priceStep: step };
  }, [candles]);

  const priceToY = (price: number) => {
    if (maxPrice === minPrice) return paddingTop + innerHeight / 2;
    const ratio = (price - minPrice) / (maxPrice - minPrice);
    return paddingTop + innerHeight * (1 - ratio);
  };

  const candleCount = candles.length;
  const candleSlotWidth = innerWidth / Math.max(1, candleCount);
  const candleBodyWidth = Math.max(3, Math.min(14, candleSlotWidth * 0.65));

  const activeCandle = hoverIndex !== null && candles[hoverIndex] ? candles[hoverIndex] : candles[candles.length - 1];
  const activeChange = activeCandle ? ((activeCandle.close - activeCandle.open) / (activeCandle.open || 1)) * 100 : 0;
  const activeIsGreen = activeCandle ? activeCandle.close >= activeCandle.open : true;

  // Generate 5 Y-axis gridlines
  const yTicks = useMemo(() => {
    return [0, 1, 2, 3, 4].map((i) => {
      const price = minPrice + priceStep * i;
      const y = priceToY(price);
      return { price, y };
    });
  }, [minPrice, priceStep, maxPrice]);

  // Generate X-axis time ticks
  const xTicks = useMemo(() => {
    if (candles.length === 0) return [];
    const step = Math.max(1, Math.floor(candles.length / 5));
    const ticks: { x: number; label: string }[] = [];
    for (let i = 0; i < candles.length; i += step) {
      const c = candles[i];
      const d = new Date(c.time);
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      const label = `${hours}:${mins}`;
      const x = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;
      ticks.push({ x, label });
    }
    return ticks;
  }, [candles, candleSlotWidth]);

  // Current live price Y coordinate
  const currentPriceNum = parseFloat(currentPrice) || (candles[candles.length - 1]?.close ?? 60000);
  const currentPriceY = priceToY(currentPriceNum);

  return (
    <div
      ref={containerRef}
      className="w-full relative bg-[#0e1116] rounded-lg p-2.5 overflow-hidden flex flex-col justify-between select-none"
    >
      {/* Chart Header Bar: Legend + Live Hover Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-[#848e9c] z-10 font-numeric mb-1">
        {/* Dynamic MA Indicators */}
        <div className="flex items-center gap-3">
          <span className="text-[#f5b642] font-semibold">
            MA(7): {ma7[ma7.length - 1]?.toFixed(2) ?? '--'}
          </span>
          <span className="text-[#3b82f6] font-semibold">
            MA(25): {ma25[ma25.length - 1]?.toFixed(2) ?? '--'}
          </span>
        </div>

        {/* Dynamic Candle Stats on Hover */}
        {activeCandle && (
          <div className="flex items-center gap-2.5 font-numeric">
            <span>
              O: <strong className="text-white">{formatPrice(activeCandle.open.toFixed(2), tickSize)}</strong>
            </span>
            <span>
              H: <strong className="text-white">{formatPrice(activeCandle.high.toFixed(2), tickSize)}</strong>
            </span>
            <span>
              L: <strong className="text-white">{formatPrice(activeCandle.low.toFixed(2), tickSize)}</strong>
            </span>
            <span>
              C:{' '}
              <strong className={activeIsGreen ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                {formatPrice(activeCandle.close.toFixed(2), tickSize)}
              </strong>
            </span>
            <span className={activeIsGreen ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
              ({activeIsGreen ? '+' : ''}
              {activeChange.toFixed(2)}%)
            </span>
            <span className="hidden sm:inline">
              Vol: <strong className="text-white">{activeCandle.volume.toFixed(4)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full h-52">
        <svg
          className="w-full h-full overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const mouseX = e.clientX - rect.left - paddingLeft;
            const idx = Math.floor(mouseX / candleSlotWidth);
            if (idx >= 0 && idx < candles.length) {
              setHoverIndex(idx);
            }
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Horizontal Grid Lines & Price Labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={width - paddingRight}
                y2={tick.y}
                stroke="#1c212a"
                strokeDasharray="3 3"
              />
              <text
                x={width - paddingRight + 6}
                y={tick.y + 3.5}
                fill="#5e6673"
                fontSize="9"
                fontFamily="monospace"
              >
                ${tick.price.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Current Live Price Line */}
          <line
            x1={paddingLeft}
            y1={currentPriceY}
            x2={width - paddingRight}
            y2={currentPriceY}
            stroke="#0ecb81"
            strokeDasharray="2 2"
            strokeOpacity="0.8"
          />
          {/* Live Price Tag Pill */}
          <g transform={`translate(${width - paddingRight + 4}, ${currentPriceY - 8})`}>
            <rect width="58" height="16" rx="3" fill="#0ecb81" />
            <text x="5" y="11" fill="#000" fontSize="9" fontWeight="bold" fontFamily="monospace">
              ${formatPrice(currentPriceNum.toFixed(1), tickSize)}
            </text>
          </g>

          {/* Candlesticks Series */}
          {candles.map((c, idx) => {
            const isGreen = c.close >= c.open;
            const color = isGreen ? '#0ecb81' : '#f6465d';

            const centerX = paddingLeft + idx * candleSlotWidth + candleSlotWidth / 2;
            const rectX = centerX - candleBodyWidth / 2;

            const openY = priceToY(c.open);
            const closeY = priceToY(c.close);
            const highY = priceToY(c.high);
            const lowY = priceToY(c.low);

            const rectY = Math.min(openY, closeY);
            const rectHeight = Math.max(2, Math.abs(openY - closeY));

            return (
              <g key={idx}>
                {/* Wick */}
                <line
                  x1={centerX}
                  y1={highY}
                  x2={centerX}
                  y2={lowY}
                  stroke={color}
                  strokeWidth="1.2"
                />
                {/* Body */}
                <rect
                  x={rectX}
                  y={rectY}
                  width={candleBodyWidth}
                  height={rectHeight}
                  fill={color}
                  rx="0.5"
                />
              </g>
            );
          })}

          {/* Dynamic MA(7) Yellow Line */}
          {ma7.length > 0 && (
            <path
              d={candles
                .map((_, i) => {
                  const val = ma7[i];
                  if (val === null) return null;
                  const x = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;
                  const y = priceToY(val);
                  return `${i === 6 ? 'M' : 'L'} ${x} ${y}`;
                })
                .filter(Boolean)
                .join(' ')}
              fill="none"
              stroke="#f5b642"
              strokeWidth="1.5"
              strokeOpacity="0.85"
            />
          )}

          {/* Dynamic MA(25) Blue Line */}
          {ma25.length > 0 && (
            <path
              d={candles
                .map((_, i) => {
                  const val = ma25[i];
                  if (val === null) return null;
                  const x = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;
                  const y = priceToY(val);
                  return `${i === 24 ? 'M' : 'L'} ${x} ${y}`;
                })
                .filter(Boolean)
                .join(' ')}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />
          )}

          {/* Hover Crosshair */}
          {hoverIndex !== null && (
            <>
              <line
                x1={paddingLeft + hoverIndex * candleSlotWidth + candleSlotWidth / 2}
                y1={paddingTop}
                x2={paddingLeft + hoverIndex * candleSlotWidth + candleSlotWidth / 2}
                y2={paddingTop + innerHeight}
                stroke="#848e9c"
                strokeWidth="0.8"
                strokeDasharray="3 3"
              />
            </>
          )}

          {/* X-Axis Time Ticks */}
          {xTicks.map((t, idx) => (
            <text
              key={idx}
              x={t.x}
              y={height - 6}
              textAnchor="middle"
              fill="#5e6673"
              fontSize="9"
              fontFamily="monospace"
            >
              {t.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
