package orderbook

type OrderBook struct {
	Bids         SideBook
	Asks         SideBook
	ActiveOrders map[string]*Order // map from OrderID to *Order
}

func NewOrderBook() *OrderBook {
	return &OrderBook{
		Bids: SideBook{
			heap:   PriceHeap{max: true},
			levels: make(map[string]*PriceLevel),
		},
		Asks: SideBook{
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

