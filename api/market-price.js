function toNumber(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPrice(payload) {
  const entry = Array.isArray(payload?.data) ? payload.data[0] : payload?.data || payload?.result || payload;
  if (!entry) return null;

  const directPrice = toNumber(entry.price);
  if (Number.isFinite(directPrice) && directPrice > 0) return directPrice;

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
    const sources = [
      'https://api.gold-api.com/price/XAU',
      'https://giavang.now/api/prices?type=XAUUSD'
    ];

    let price = null;
    let sourceUrl = sources[0];
    let payload = null;

    for (const candidate of sources) {
      try {
        const response = await fetch(candidate, {
          headers: {
            accept: 'application/json',
            'cache-control': 'no-cache'
          }
        });
        if (!response.ok) {
          throw new Error(`Upstream quote request failed with ${response.status}`);
        }
        const json = await response.json();
        const candidatePrice = extractPrice(json);
        if (Number.isFinite(candidatePrice) && candidatePrice > 0) {
          price = candidatePrice;
          sourceUrl = candidate;
          payload = json;
          break;
        }
      } catch (error) {
        console.warn('MARKET_PRICE_SOURCE_FAILED:', candidate, error?.message || error);
      }
    }

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('No valid XAU/USD price returned');
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.status(200).json({
      ok: true,
      symbol: 'XAUUSD',
      price,
      source: sourceUrl,
      updatedAt: payload?.updatedAt || payload?.updated_at || new Date().toISOString()
    });
  } catch (error) {
    console.error('MARKET_PRICE_FAILED:', error);
    return res.status(500).json({ error: error.message });
  }
}
