package orderbook

import "github.com/TrVHau/hau-cex/services/matching-engine/internal/fixed"

type OrderBook struct {
	Bids         SideBook
	Asks         SideBook
	ActiveOrders map[string]*Order // map from OrderID to *Order
}

func NewOrderBook() *OrderBook {
	return &OrderBook{
		Bids: SideBook{
			side:   Buy,
			heap:   PriceHeap{max: true},
			levels: make(map[string]*PriceLevel),
		},
		Asks: SideBook{
			side:   Sell,
			heap:   PriceHeap{max: false},
			levels: make(map[string]*PriceLevel),
		},
		ActiveOrders: make(map[string]*Order),
	}
}

func (ob *OrderBook) AddOrder(order *Order) {
	if order.Side == Buy {
		ob.Bids.AddOrder(order)
	} else {
		ob.Asks.AddOrder(order)
	}
	ob.ActiveOrders[order.OrderID] = order
}

func (ob *OrderBook) RemoveOrder(orderID string) bool {
	order, ok := ob.ActiveOrders[orderID]
	if !ok {
		return false
	}
	var removed bool
	if order.Side == Buy {
		removed = ob.Bids.RemoveOrder(orderID, order.Price)
	} else {
		removed = ob.Asks.RemoveOrder(orderID, order.Price)
	}
	if removed {
		delete(ob.ActiveOrders, orderID)
	}
	return removed
}

func (ob *OrderBook) GetBid() (fixed.Decimal, bool) {
	return ob.Bids.BestPrice()
}

func (ob *OrderBook) GetAsk() (fixed.Decimal, bool) {
	return ob.Asks.BestPrice()
}
