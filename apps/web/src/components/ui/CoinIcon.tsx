import { useState } from 'react';

const SVG_COINS = new Set([
  'aave',
  'ada',
  'atom',
  'avax',
  'bch',
  'bnb',
  'btc',
  'dai',
  'doge',
  'dot',
  'etc',
  'eth',
  'fil',
  'link',
  'ltc',
  'matic',
  'mkr',
  'sol',
  'trx',
  'uni',
  'usdc',
  'usdt',
  'xlm',
  'xrp',
]);

const PNG_COINS = new Set([
  'apt',
  'arb',
  'near',
  'op',
  'shib',
  'sui',
  'ton',
]);

const WEBP_COINS = new Set(['pepe']);

const SYMBOL_ALIASES: Record<string, string> = {
  wbtc: 'btc',
  weth: 'eth',
  pol: 'matic',
};

function getCoinIconUrl(symbol: string): string | null {
  const normalized = (symbol || '').trim().toLowerCase();
  if (!normalized) return null;
  const resolved = SYMBOL_ALIASES[normalized] ?? normalized;
  if (SVG_COINS.has(resolved)) return `/coins/${resolved}.svg`;
  if (PNG_COINS.has(resolved)) return `/coins/${resolved}.png`;
  if (WEBP_COINS.has(resolved)) return `/coins/${resolved}.webp`;
  return null;
}

export type CoinIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<CoinIconSize, { box: string; text: string }> = {
  xs: { box: 'w-4 h-4', text: 'text-[8px]' },
  sm: { box: 'w-6 h-6', text: 'text-[10px]' },
  md: { box: 'w-7 h-7', text: 'text-[10px]' },
  lg: { box: 'w-8 h-8', text: 'text-xs' },
  xl: { box: 'w-10 h-10', text: 'text-sm' },
};

interface CoinIconProps {
  symbol: string;
  size?: CoinIconSize;
  className?: string;
}

/**
 * Renders a cryptocurrency icon from local static assets with monogram fallback.
 */
export function CoinIcon({ symbol, size = 'md', className = '' }: CoinIconProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = getCoinIconUrl(symbol);
  const { box, text } = SIZE_CLASSES[size];

  if (!src || failedSrc === src) {
    return (
      <div
        className={`${box} rounded-full bg-[#1e232d] border border-[#2b3240] flex items-center justify-center font-bold ${text} text-[#f5b642] font-sans shrink-0 select-none ${className}`}
        title={symbol}
      >
        {(symbol || '?').slice(0, 3).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={symbol}
      title={symbol}
      onError={() => setFailedSrc(src)}
      className={`${box} rounded-full object-cover shrink-0 select-none ${className}`}
      loading="lazy"
    />
  );
}

interface PairIconProps {
  baseAsset: string;
  quoteAsset: string;
  size?: 'sm' | 'md' | 'lg';
}

const QUOTE_BADGE_CLASSES: Record<'sm' | 'md' | 'lg', { quoteSize: CoinIconSize; offset: string }> = {
  sm: { quoteSize: 'xs', offset: '-ml-2 mt-2' },
  md: { quoteSize: 'xs', offset: '-ml-2 mt-3' },
  lg: { quoteSize: 'sm', offset: '-ml-2.5 mt-3' },
};

/**
 * Renders overlapping base/quote cryptocurrency icons for trading pairs.
 */
export function PairIcon({ baseAsset, quoteAsset, size = 'md' }: PairIconProps) {
  const { quoteSize, offset } = QUOTE_BADGE_CLASSES[size];
  return (
    <div className="inline-flex items-center shrink-0">
      <CoinIcon symbol={baseAsset} size={size} className="z-10" />
      <CoinIcon
        symbol={quoteAsset}
        size={quoteSize}
        className={`${offset} ring-2 ring-[#14171d] bg-[#14171d]`}
      />
    </div>
  );
}
