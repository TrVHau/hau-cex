package orderbook

import (
	"github.com/TrVHau/hau-cex/services/matching-engine/internal/fixed"
)

type Side string

const (
	Buy  Side = "BUY"
	Sell Side = "SELL"
)

type Order struct {
	OrderID           string
	UserID            string
	TradingPairID     string
	Side              Side
	Price             fixed.Decimal
	OriginalQuantity  fixed.Decimal
	RemainingQuantity fixed.Decimal
	OrderSeq          uint64
}
