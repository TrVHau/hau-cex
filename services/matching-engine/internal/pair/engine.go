package pair

import (
	"errors"
	"fmt"

	"github.com/TrVHau/hau-cex/services/matching-engine/internal/matching"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/message"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/orderbook"
)

type EngineState string

const (
	StateRecovering EngineState = "RECOVERING"
	StateReady      EngineState = "READY"
	StateSuspended  EngineState = "SUSPENDED"
	StateFailed     EngineState = "FAILED"
)

var (
	ErrDuplicateCommand = errors.New("duplicate command sequence")
	ErrSequenceGap      = errors.New("command sequence gap")
)

type PairEngine struct {
	PairID              string
	Market              string
	State               EngineState
	Book                *orderbook.OrderBook
	LastProcessedCmdSeq uint64
	LastTradeSequence   uint64
	LastBookSequence    uint64
	InFlight            *InFlightBatch
}

type InFlightBatch struct {
	CommandSequence uint64
	Events          []message.EventEnvelope
	Published       bool
}

func (e *PairEngine) HandleOpenMarket(cmd message.OpenMarketCommand, cmdSeq uint64) []message.EventEnvelope {
	if err := e.validateSeq(cmdSeq); err == ErrDuplicateCommand {
		return nil
	} else if err == ErrSequenceGap {
		e.State = StateFailed
		return []message.EventEnvelope{buildEngineFailed(e, cmdSeq, "COMMAND_SEQUENCE_GAP")}
	}
	e.State = StateReady
	e.LastProcessedCmdSeq = cmdSeq
	return []message.EventEnvelope{buildMarketOpened(e)}
}

func (e *PairEngine) HandlePlaceOrder(cmd message.PlaceOrderCommand, cmdSeq uint64) []message.EventEnvelope {
	if err := e.validateSeq(cmdSeq); err == ErrDuplicateCommand {
		return nil
	} else if err == ErrSequenceGap {
		e.State = StateFailed
		return []message.EventEnvelope{buildEngineFailed(e, cmdSeq, "COMMAND_SEQUENCE_GAP")}
	}
	if e.State != StateReady {
		return []message.EventEnvelope{buildOrderRejected(cmd, "MARKET_NOT_READY")}
	}

	incoming := &orderbook.Order{
		OrderID:           cmd.OrderID,
		UserID:            cmd.UserID,
		Side:              cmd.Side,
		Price:             cmd.Price,
		OriginalQuantity:  cmd.Quantity,
		RemainingQuantity: cmd.Quantity,
		OrderSeq:          cmd.OrderSeq,
	}

	result := matching.Match(e.Book, incoming, cmdSeq)
	var events []message.EventEnvelope

	for _, trade := range result.Trades {
		e.LastTradeSequence++
		engineMatchId := fmt.Sprintf("%s:%d:%d", e.PairID, cmdSeq, trade.MatchIndex)
		events = append(events, buildTradeCreated(e, trade, engineMatchId, cmdSeq))
	}

	if !result.IncomingFull {
		events = append(events, buildOrderOpened(e, cmd, incoming.RemainingQuantity))
	}

	e.LastBookSequence++
	events = append(events, buildOrderBookChanged(e))
	e.LastProcessedCmdSeq = cmdSeq
	return events
}

func (e *PairEngine) HandleCancelOrder(cmd message.CancelOrderCommand, cmdSeq uint64) []message.EventEnvelope {
	if err := e.validateSeq(cmdSeq); err == ErrDuplicateCommand {
		return nil
	} else if err == ErrSequenceGap {
		e.State = StateFailed
		return []message.EventEnvelope{buildEngineFailed(e, cmdSeq, "COMMAND_SEQUENCE_GAP")}
	}
	if e.State != StateReady {
		return []message.EventEnvelope{buildCancelOrderRejected(cmd, "MARKET_NOT_READY")}
	}

	order, ok := e.Book.ActiveOrders[cmd.OrderID]
	if !ok {
		return []message.EventEnvelope{buildCancelOrderRejected(cmd, "ORDER_NOT_FOUND")}
	}

	e.Book.RemoveOrder(cmd.OrderID)
	e.LastBookSequence++
	e.LastProcessedCmdSeq = cmdSeq

	return []message.EventEnvelope{
		buildOrderCanceled(e, cmd, order.RemainingQuantity),
		buildOrderBookChanged(e),
	}
}

// Sequence validation
func (e *PairEngine) validateSeq(cmdSeq uint64) error {
	expected := e.LastProcessedCmdSeq + 1
	if cmdSeq < expected {
		return ErrDuplicateCommand // đã xử lý, skip
	}
	if cmdSeq > expected {
		return ErrSequenceGap // block Pair
	}
	return nil
}
