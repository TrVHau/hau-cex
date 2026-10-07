package message

import (
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/fixed"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/orderbook"
)

type CommandType string

const (
	CommandOpenMarket    CommandType = "OpenMarket"
	CommandPlaceOrder    CommandType = "PlaceOrder"
	CommandCancelOrder   CommandType = "CancelOrder"
	CommandSuspendMarket CommandType = "SuspendMarket"
)

type Command interface {
	CommandType() CommandType
}

type OpenMarketCommand struct {
	TradingPairID     string        `json:"tradingPairId"`
	Market            string        `json:"market"`
	BaseAssetID       string        `json:"baseAssetId"`
	QuoteAssetID      string        `json:"quoteAssetId"`
	PricePrecision    int           `json:"pricePrecision"`
	QuantityPrecision int           `json:"quantityPrecision"`
	TickSize          fixed.Decimal `json:"tickSize"`
	StepSize          fixed.Decimal `json:"stepSize"`
	MinQuantity       fixed.Decimal `json:"minQuantity"`
	MinNotional       fixed.Decimal `json:"minNotional"`
	OpenedAt          string        `json:"openedAt"`
}

func (c *OpenMarketCommand) CommandType() CommandType {
	return CommandOpenMarket
}

type PlaceOrderCommand struct {
	TradingPairID string         `json:"tradingPairId"`
	Market        string         `json:"market"`
	OrderID       string         `json:"orderId"`
	UserID        string         `json:"userId"`
	Side          orderbook.Side `json:"side"`
	Type          string         `json:"type"`
	Price         fixed.Decimal  `json:"price"`
	Quantity      fixed.Decimal  `json:"quantity"`
	OrderSequence uint64         `json:"orderSequence,string"`
	CreatedAt     string         `json:"createdAt"`
}

func (c *PlaceOrderCommand) CommandType() CommandType {
	return CommandPlaceOrder
}

type CancelOrderCommand struct {
	TradingPairID string `json:"tradingPairId"`
	Market        string `json:"market"`
	OrderID       string `json:"orderId"`
	UserID        string `json:"userId"`
	RequestedBy   string `json:"requestedBy"`
	RequestedAt   string `json:"requestedAt"`
}

func (c *CancelOrderCommand) CommandType() CommandType {
	return CommandCancelOrder
}

type SuspendMarketCommand struct {
	TradingPairID string `json:"tradingPairId"`
	Market        string `json:"market"`
	Reason        string `json:"reason"`
	SuspendedAt   string `json:"suspendedAt"`
}

func (c *SuspendMarketCommand) CommandType() CommandType {
	return CommandSuspendMarket
}
