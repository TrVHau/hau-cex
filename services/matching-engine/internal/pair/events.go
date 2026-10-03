package pair

import (
	"fmt"
	"strconv"
	"time"

	"github.com/TrVHau/hau-cex/services/matching-engine/internal/fixed"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/matching"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/message"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/orderbook"
	"github.com/google/uuid"
)

// ─── Payload structs ────────────────────────────────────────────────────────

type MarketOpenedPayload struct {
	TradingPairID string    `json:"tradingPairId"`
	Market        string    `json:"market"`
	OpenedAt      time.Time `json:"openedAt"`
}

type OrderOpenedPayload struct {
	TradingPairID     string    `json:"tradingPairId"`
	Market            string    `json:"market"`
	OrderID           string    `json:"orderId"`
	RemainingQuantity string    `json:"remainingQuantity"`
	OpenedAt          time.Time `json:"openedAt"`
}

type TradeCreatedPayload struct {
	TradeID                    string    `json:"tradeId"`
	EngineMatchID              string    `json:"engineMatchId"`
	TradingPairID              string    `json:"tradingPairId"`
	Market                     string    `json:"market"`
	TradeSequence              string    `json:"tradeSequence"`
	MatchIndex                 int       `json:"matchIndex"`
	BuyOrderID                 string    `json:"buyOrderId"`
	SellOrderID                string    `json:"sellOrderId"`
	MakerOrderID               string    `json:"makerOrderId"`
	TakerOrderID               string    `json:"takerOrderId"`
	TakerSide                  string    `json:"takerSide"`
	ExecutionPrice             string    `json:"executionPrice"`
	ExecutedQuantity           string    `json:"executedQuantity"`
	BuyOrderRemainingQuantity  string    `json:"buyOrderRemainingQuantity"`
	SellOrderRemainingQuantity string    `json:"sellOrderRemainingQuantity"`
	MatchedAt                  time.Time `json:"matchedAt"`
}

type OrderCancelledPayload struct {
	TradingPairID     string    `json:"tradingPairId"`
	Market            string    `json:"market"`
	OrderID           string    `json:"orderId"`
	CancelledQuantity string    `json:"cancelledQuantity"`
	CancelledAt       time.Time `json:"cancelledAt"`
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
	Bids          [][3]string `json:"bids"` // [price, totalQuantity, orderCount]
	Asks          [][3]string `json:"asks"`
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

// ─── Builder functions ───────────────────────────────────────────────────────

func buildMarketOpened(e *PairEngine, cmdSeq uint64) message.EventEnvelope {
	return envelope(e, "MarketOpened", cmdSeq, MarketOpenedPayload{
		TradingPairID: e.PairID,
		Market:        e.Market,
		OpenedAt:      time.Now().UTC(),
	})
}

func buildEngineFailed(e *PairEngine, cmdSeq uint64, failureCode string, failureMessage string) message.EventEnvelope {
	return envelope(e, "EngineFailed", cmdSeq, EngineFailedPayload{
		TradingPairID:  e.PairID,
		Market:         e.Market,
		FailureCode:    failureCode,
		FailureMessage: failureMessage,
		FailedAt:       time.Now().UTC(),
	})
}

func buildOrderRejected(e *PairEngine, cmd message.PlaceOrderCommand, cmdSeq uint64, reasonCode string) message.EventEnvelope {
	return envelope(e, "OrderRejected", cmdSeq, OrderRejectedPayload{
		TradingPairID: e.PairID,
		Market:        e.Market,
		OrderID:       cmd.OrderID,
		ReasonCode:    reasonCode,
		Reason:        reasonCode,
		RejectedAt:    time.Now().UTC(),
	})
}

func buildTradeCreated(e *PairEngine, incoming message.PlaceOrderCommand, trade matching.TradeResult, engineMatchID string, cmdSeq uint64) message.EventEnvelope {
	// Determine buy/sell sides
	makerOrderID := trade.RestingOrderId
	takerOrderID := incoming.OrderID
	var buyOrderID, sellOrderID string
	var buyRemaining, sellRemaining fixed.Decimal

	if incoming.Side == orderbook.Buy {
		buyOrderID = incoming.OrderID
		sellOrderID = trade.RestingOrderId
		buyRemaining = trade.IncomingRemainingQuantity
		sellRemaining = trade.RestingRemainingQuantity
	} else {
		buyOrderID = trade.RestingOrderId
		sellOrderID = incoming.OrderID
		buyRemaining = trade.RestingRemainingQuantity
		sellRemaining = trade.IncomingRemainingQuantity
	}

	return envelope(e, "TradeCreated", cmdSeq, TradeCreatedPayload{
		TradeID:                    uuid.NewString(),
		EngineMatchID:              engineMatchID,
		TradingPairID:              e.PairID,
		Market:                     e.Market,
		TradeSequence:              strconv.FormatUint(e.LastTradeSequence, 10),
		MatchIndex:                 trade.MatchIndex,
		BuyOrderID:                 buyOrderID,
		SellOrderID:                sellOrderID,
		MakerOrderID:               makerOrderID,
		TakerOrderID:               takerOrderID,
		TakerSide:                  string(incoming.Side),
		ExecutionPrice:             trade.ExecutionPrice.String(),
		ExecutedQuantity:           trade.ExecutedQuantity.String(),
		BuyOrderRemainingQuantity:  buyRemaining.String(),
		SellOrderRemainingQuantity: sellRemaining.String(),
		MatchedAt:                  time.Now().UTC(),
	})
}

func buildOrderOpened(e *PairEngine, cmd message.PlaceOrderCommand, cmdSeq uint64, remainingQuantity fixed.Decimal) message.EventEnvelope {
	return envelope(e, "OrderOpened", cmdSeq, OrderOpenedPayload{
		TradingPairID:     e.PairID,
		Market:            e.Market,
		OrderID:           cmd.OrderID,
		RemainingQuantity: remainingQuantity.String(),
		OpenedAt:          time.Now().UTC(),
	})
}

func buildOrderBookChanged(e *PairEngine, cmdSeq uint64) message.EventEnvelope {
	return envelope(e, "OrderBookChanged", cmdSeq, OrderBookChangedPayload{
		TradingPairID: e.PairID,
		Market:        e.Market,
		BookSequence:  strconv.FormatUint(e.LastBookSequence, 10),
		Bids:          bookLevels(e.Book.Bids),
		Asks:          bookLevels(e.Book.Asks),
		ChangedAt:     time.Now().UTC(),
	})
}

func buildCancelOrderRejected(e *PairEngine, cmd message.CancelOrderCommand, cmdSeq uint64, reasonCode string) message.EventEnvelope {
	return envelope(e, "CancelOrderRejected", cmdSeq, CancelOrderRejectedPayload{
		TradingPairID: e.PairID,
		Market:        e.Market,
		OrderID:       cmd.OrderID,
		ReasonCode:    reasonCode,
		Reason:        reasonCode,
		RejectedAt:    time.Now().UTC(),
	})
}

func buildOrderCancelled(e *PairEngine, cmd message.CancelOrderCommand, cmdSeq uint64, remainingQuantity fixed.Decimal) message.EventEnvelope {
	return envelope(e, "OrderCancelled", cmdSeq, OrderCancelledPayload{
		TradingPairID:     e.PairID,
		Market:            e.Market,
		OrderID:           cmd.OrderID,
		CancelledQuantity: remainingQuantity.String(),
		CancelledAt:       time.Now().UTC(),
	})
}

// ─── Helpers ────────────────────────────────────────────────────────────────

func envelope(e *PairEngine, messageType string, cmdSeq uint64, payload any) message.EventEnvelope {
	return message.EventEnvelope{
		MessageID:       uuid.NewString(),
		MessageType:     messageType,
		Version:         1,
		CorrelationID:   uuid.NewString(),
		OccurredAt:      time.Now().UTC(),
		PartitionKey:    e.PairID,
		CommandSequence: strconv.FormatUint(cmdSeq, 10),
		Payload:         payload,
	}
}

// bookLevels converts a SideBook into the [][3]string wire format.
func bookLevels(book orderbook.SideBook) [][3]string {
	levels := make([][3]string, 0, len(book.Levels()))
	for price, level := range book.Levels() {
		levels = append(levels, [3]string{
			price,
			level.TotalQuantity.String(),
			fmt.Sprintf("%d", level.Count()),
		})
	}
	return levels
}
