function toNumber(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPrice(payload) {
  const entry = Array.isArray(payload?.data) ? payload.data[0] : payload?.data || payload?.result || payload;
  if (!entry) return null;

  const buy = toNumber(entry.buy);
  const sell = toNumber(entry.sell);
  if (Number.isFinite(buy) && buy > 0) return buy;
  if (Number.isFinite(sell) && sell > 0) return sell;

  const directCandidates = [
    entry.price,
    entry.last,
    entry.last_price,
    entry.current_price,
    entry.close
  ].map(toNumber).filter(value => Number.isFinite(value) && value > 0);

  if (directCandidates.length) return directCandidates[0];
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sourceUrl = 'https://giavang.now/api/prices?type=XAUUSD';
    const response = await fetch(sourceUrl, {
      headers: {
        accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream quote request failed with ${response.status}`);
    }

    const payload = await response.json();
    const price = extractPrice(payload);

    if (!Number.isFinite(price)) {
      throw new Error('No valid XAU/USD price returned');
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({
      ok: true,
      symbol: 'XAUUSD',
      price,
      source: sourceUrl,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('MARKET_PRICE_FAILED:', error);
    return res.status(500).json({ error: error.message });
  }
}
