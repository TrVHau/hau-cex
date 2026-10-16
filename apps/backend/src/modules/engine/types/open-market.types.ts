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
