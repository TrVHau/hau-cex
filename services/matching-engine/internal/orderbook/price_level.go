package orderbook

import (
	"container/list"

	"github.com/TrVHau/hau-cex/services/matching-engine/internal/fixed"
)

type PriceLevel struct {
	Price   fixed.Decimal
	TotalQuantity fixed.Decimal
	orders  *list.List // fifo queue of *Order
	orderMap map[string]*list.Element // map from OrderID to list.Element
}

func (pl *PriceLevel) Enqueue(order *Order) {
	if pl.orders == nil {
		pl.orders = list.New()
		pl.orderMap = make(map[string]*list.Element)
	}
	elem := pl.orders.PushBack(order)
	pl.orderMap[order.OrderID] = elem
	pl.TotalQuantity = pl.TotalQuantity.Add(order.RemainingQuantity)
}

func (pl *PriceLevel) Front() *Order {
	if pl.orders == nil || pl.orders.Len() == 0 {
		return nil
	}
	elem := pl.orders.Front()
	return elem.Value.(*Order)
}

func (pl *PriceLevel) Dequeue() *Order {
	if pl.orders == nil || pl.orders.Len() == 0 {
		return nil
	}
	elem := pl.orders.Front()
	order := elem.Value.(*Order)
	pl.TotalQuantity = pl.TotalQuantity.Sub(order.RemainingQuantity)
	pl.orders.Remove(elem)
	delete(pl.orderMap, order.OrderID)
	return order
}

func (pl *PriceLevel) Remove(orderID string) *Order {
	elem, ok := pl.orderMap[orderID]
	if !ok {
		return nil
	}
	order := elem.Value.(*Order)
	pl.TotalQuantity = pl.TotalQuantity.Sub(order.RemainingQuantity)
	pl.orders.Remove(elem)
	delete(pl.orderMap, orderID)
	return order
}

func (pl *PriceLevel) IsEmpty() bool {
	return pl.orders == nil || pl.orders.Len() == 0
}