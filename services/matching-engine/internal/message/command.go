package message

import (
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/fixed"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/orderbook"
)

type CommandType string

const (
	CommandOpenMarket    CommandType = "OPEN_MARKET"
	CommandPlaceOrder    CommandType = "PLACE_ORDER"
	CommandCancelOrder   CommandType = "CANCEL_ORDER"
	CommandSuspendMarket CommandType = "SUSPEND_MARKET"
)

type Command interface {
	CommandType() CommandType
}

type OpenMarketCommand struct {
	tradingPairID string
	market        string
	tickSize      fixed.Decimal
	MinQuantity   fixed.Decimal
	MinNotional   fixed.Decimal
}

func (c *OpenMarketCommand) CommandType() CommandType {
	return CommandOpenMarket
}

type PlaceOrderCommand struct {
	TradingPairID string
	Market        string
	OrderID       string
	UserID        string
	Side          orderbook.Side
	Price         fixed.Decimal
	Quantity      fixed.Decimal
	OrderSeq      uint64
}

func (c *PlaceOrderCommand) CommandType() CommandType {
	return CommandPlaceOrder
}

type CancelOrderCommand struct {
	TradingPairID string
	Market        string
	OrderID       string
	UserID        string
	RequestdBy    string
}

func (c *CancelOrderCommand) CommandType() CommandType {
	return CommandCancelOrder
}

type SuspendMarketCommand struct {
	TradingPairID string
	Market        string
	Reason        string
}

func (c *SuspendMarketCommand) CommandType() CommandType {
	return CommandSuspendMarket
}
