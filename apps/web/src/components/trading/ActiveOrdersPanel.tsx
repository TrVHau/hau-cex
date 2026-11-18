import { useActiveOrders, useCancelOrder } from '../../hooks/useApi';
import { Card, Badge, Button, Spinner } from '../ui';
import { formatPrice, formatQty, formatDateTime, parseApiError } from '../../lib/utils';
import type { Order } from '../../types';
import { useState } from 'react';

function statusBadge(status: Order['status']) {
  switch (status) {
    case 'OPEN':
    case 'PARTIALLY_FILLED':
      return <Badge variant="blue">{status.replace('_', ' ')}</Badge>;
    case 'FILLED':
      return <Badge variant="green">FILLED</Badge>;
    case 'CANCELLED':
    case 'REJECTED':
      return <Badge variant="red">{status}</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

interface Props {
  symbol?: string; // filter by symbol nếu cần
  tickSize: string;
  basePrecision: number;
}

export function ActiveOrdersPanel({ symbol, tickSize, basePrecision }: Props) {
  const { data: orders, isLoading } = useActiveOrders();
  const cancelOrder = useCancelOrder();
  const [cancelError, setCancelError] = useState<string | null>(null);

  const filtered = symbol ? orders?.filter((o) => o.symbol === symbol) : orders;

  const handleCancel = async (orderId: string) => {
    setCancelError(null);
    try {
      await cancelOrder.mutateAsync(orderId);
    } catch (err) {
      setCancelError(parseApiError(err));
    }
  };

  return (
    <Card title="Active Orders" className="h-full">
      {cancelError && (
        <div className="text-red-400 text-xs mb-2 px-1">{cancelError}</div>
      )}

      {isLoading && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {!isLoading && (!filtered || filtered.length === 0) && (
        <div className="text-gray-500 text-center py-6 text-sm">Không có lệnh đang mở</div>
      )}

      {filtered && filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left pb-2 font-medium">Pair</th>
                <th className="text-left pb-2 font-medium">Side</th>
                <th className="text-right pb-2 font-medium">Price</th>
                <th className="text-right pb-2 font-medium">Qty</th>
                <th className="text-right pb-2 font-medium">Filled</th>
                <th className="text-right pb-2 font-medium">Status</th>
                <th className="text-right pb-2 font-medium">Time</th>
                <th className="text-right pb-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className="border-b border-gray-700/40 hover:bg-gray-700/20">
                  <td className="py-2 text-gray-200">{order.symbol}</td>
                  <td className="py-2">
                    <span
                      className={order.side === 'BUY' ? 'text-green-400' : 'text-red-400'}
                    >
                      {order.side}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono text-gray-200">
                    {formatPrice(order.price, tickSize)}
                  </td>
                  <td className="py-2 text-right font-mono text-gray-200">
                    {formatQty(order.quantity, basePrecision)}
                  </td>
                  <td className="py-2 text-right font-mono text-gray-400">
                    {formatQty(order.filledQty, basePrecision)}
                  </td>
                  <td className="py-2 text-right">{statusBadge(order.status)}</td>
                  <td className="py-2 text-right text-gray-500">
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td className="py-2 text-right">
                    {(order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => { void handleCancel(order.id); }}
                        isLoading={cancelOrder.isPending && cancelOrder.variables === order.id}
                      >
                        Cancel
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
