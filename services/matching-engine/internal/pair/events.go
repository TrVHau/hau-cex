package pair

import (
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/fixed"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/matching"
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/message"
)

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
