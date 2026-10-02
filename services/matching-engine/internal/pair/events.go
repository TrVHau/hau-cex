package pair

import (
	"time"

	"github.com/TrVHau/hau-cex/services/matching-engine/internal/fixed"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/matching"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/message"
)

type MarketOpenedPayload struct {
	TradingPairID string    `json:"tradingPairId"`
	Market        string    `json:"market"`
	OpenedAt      time.Time `json:"openedAt"`
}

type OrderOpenedPayload struct {
	TradingPairID     string        `json:"tradingPairId"`
	Market            string        `json:"market"`
	OrderID           string        `json:"orderId"`
	RemainingQuantity fixed.Decimal `json:"remainingQuantity"`
	OpenedAt          time.Time     `json:"openedAt"`
}

type TradeCreatedPayload struct {
	TradeID                    string    `json:"tradeId"`
	EngineMatchID              string    `json:"engineMatchId"`
	TradingPairID              string    `json:"tradingPairId"`
	Market                     string    `json:"market"`
	TradeSequence              string    `json:"tradeSequence"`
	MatchIndex                 uint64    `json:"matchIndex"`
	BuyOrderID                 string    `json:"buyOrderId"`
	SellOrderID                string    `json:"sellOrderId"`
	MakerOrderID               string    `json:"makerOrderId"`
	TakerOrderID               string    `json:"takerOrderId"`
	TakerSide                  string    `json:"takerSide"`
	ExecutionPrice             string    `json:"executionPrice"`
	ExecutedQuantity           string    `json:"executedQuantity"`
	BuyOrderRemainingQuantity  string    `json:"buyOrderRemainingQuantity"`
	SellOrderRemainingQuantity string    `json:"sellOrderRemainingQuantity"`
	MatchAt                    time.Time `json:"matchAt"`
}

type OrderCanceledPayload struct {
	TradingPairID     string    `json:"tradingPairId"`
	Market            string    `json:"market"`
	OrderID           string    `json:"orderId"`
	CancelledQuantity string    `json:"cancelledQuantity"`
	CanceledAt        time.Time `json:"canceledAt"`
}

type EngineFailedPayload struct {
	TradingPairID  string    `json:"tradingPairId"`
	Market         string    `json:"market"`
	FailureCode    string    `json:"failureCode"`
	FailureMessage string    `json:"failureMessage"`
	FailedAt       time.Time `json:"failedAt"`
}

type OrderBookChangedPayload struct {
	TradingPairID string      `json:"tradingPairId"`
	Market        string      `json:"market"`
	BookSequence  string      `json:"bookSequence"`
	Bids          [][3]string `json:"bids"` // [price, quantity, Count]
	Asks          [][3]string `json:"asks"` // [price, quantity, Count]
	ChangedAt     time.Time   `json:"changedAt"`
}

type OrderRejectedPayload struct {
	TradingPairID string    `json:"tradingPairId"`
	Market        string    `json:"market"`
	OrderID       string    `json:"orderId"`
	ReasonCode    string    `json:"reasonCode"`
	Reason        string    `json:"reason"`
	RejectedAt    time.Time `json:"rejectedAt"`
}

type CancelOrderRejectedPayload struct {
	TradingPairID string    `json:"tradingPairId"`
	Market        string    `json:"market"`
	OrderID       string    `json:"orderId"`
	ReasonCode    string    `json:"reasonCode"`
	Reason        string    `json:"reason"`
	RejectedAt    time.Time `json:"rejectedAt"`
}

func buildMarketOpened(e *PairEngine) message.EventEnvelope {
	return message.EventEnvelope{}
}

func buildEngineFailed(e *PairEngine, cmdSeq uint64, reason string) message.EventEnvelope {
	return message.EventEnvelope{}
}

func buildOrderRejected(cmd message.PlaceOrderCommand, reason string) message.EventEnvelope {
	return message.EventEnvelope{}
}

func buildTradeCreated(e *PairEngine, trade matching.TradeResult, engineMatchingId string, cmdSeq uint64) message.EventEnvelope {
	return message.EventEnvelope{}
}

func buildOrderOpened(e *PairEngine, cmd message.PlaceOrderCommand, remainingQuantity fixed.Decimal) message.EventEnvelope {
	return message.EventEnvelope{}
}

func buildOrderBookChanged(e *PairEngine) message.EventEnvelope {
	return message.EventEnvelope{}
}

func buildCancelOrderRejected(cmd message.CancelOrderCommand, reason string) message.EventEnvelope {
	return message.EventEnvelope{}
}

func buildOrderCanceled(e *PairEngine, cmd message.CancelOrderCommand, remainingQuantity fixed.Decimal) message.EventEnvelope {
	return message.EventEnvelope{}
}
