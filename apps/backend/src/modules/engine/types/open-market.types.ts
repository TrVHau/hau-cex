export interface OpenMarketPayload {
  tradingPairId: string;
  market: string;
  baseAssetId: string;
  quoteAssetId: string;
  pricePrecision: number;
  quantityPrecision: number;
  tickSize: string;
  stepSize: string;
  minQuantity: string;
  minNotional: string;
  openedAt: string;
}

export interface SuspendMarketPayload {
  tradingPairId: string;
  market: string;
  reason: string;
  suspendedAt: string;
}
