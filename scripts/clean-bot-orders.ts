import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const rootEnvPath = resolve(__dirname, '../.env');
if (existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';

async function cancelForBot(email: string) {
  console.log(`Logging in ${email} to cancel active orders...`);
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: '123456' }),
  });

  const json = await res.json();
  const token = (json.data ?? json).accessToken;

  const ordersRes = await fetch(`${API_BASE_URL}/orders/active?symbol=BTC_USDT`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const ordersJson = await ordersRes.json();
  const activeOrders = ordersJson.data ?? ordersJson;

  console.log(`[${email}] Found ${activeOrders.length} active orders to cancel.`);

  // Cancel in parallel chunks of 15
  const chunkSize = 15;
  for (let i = 0; i < activeOrders.length; i += chunkSize) {
    const chunk = activeOrders.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((o: any) =>
        fetch(`${API_BASE_URL}/orders/${o.orderId}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      )
    );
    process.stdout.write(`.`);
  }
  console.log(`\n[${email}] Cancelled ${activeOrders.length} orders.`);
}

async function main() {
  await cancelForBot('mm-bot@haucex.com');
  await cancelForBot('taker-bot@haucex.com');
  console.log('Done cleaning active bot orders.');
}

main().catch(console.error);
