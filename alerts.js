const SB_URL = process.env.SUPABASE_URL || 'https://vtfuzcxkdrnkbonrlxbk.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY;

async function sbFetch(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || '',
      ...opts.headers
    }
  });
  if (r.status === 204) return null;
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — load alerts for user
  if (req.method === 'GET') {
    const { user } = req.query;
    if (!user) return res.status(400).json({ error: 'Missing user' });
    const data = await sbFetch(`/alerts?discogs_user=eq.${user}&is_active=eq.true&order=created_at.desc`);
    return res.status(200).json(data || []);
  }

  // POST — create alert or check alerts
  if (req.method === 'POST') {
    const { action, user, release_id, alert_type, threshold, email, current_prices } = req.body || {};

    // Create new alert
    if (action === 'create') {
      if (!user || !release_id || !alert_type) return res.status(400).json({ error: 'Missing fields' });
      const data = await sbFetch('/alerts', {
        method: 'POST',
        prefer: 'return=representation',
        body: JSON.stringify({ discogs_user: user, release_id, alert_type, threshold, email, is_active: true })
      });
      return res.status(200).json(data);
    }

    // Check all alerts against current prices
    if (action === 'check') {
      if (!user || !current_prices) return res.status(400).json({ triggered: [] });
      const alerts = await sbFetch(`/alerts?discogs_user=eq.${user}&is_active=eq.true`);
      if (!alerts?.length) return res.status(200).json({ triggered: [] });

      const triggered = [];
      for (const alert of alerts) {
        const priceData = current_prices[alert.release_id];
        if (!priceData) continue;
        const price = priceData.median || priceData.lowest || 0;
        let shouldTrigger = false;
        let message = '';

        if (alert.alert_type === 'price_below' && price <= alert.threshold) {
          shouldTrigger = true;
          message = `Prix en dessous de ${alert.threshold}€ — actuellement ${price.toFixed(2)}€`;
        } else if (alert.alert_type === 'price_above' && price >= alert.threshold) {
          shouldTrigger = true;
          message = `Prix au dessus de ${alert.threshold}€ — actuellement ${price.toFixed(2)}€`;
        } else if (alert.alert_type === 'unusual_drop' && priceData.change < -15) {
          shouldTrigger = true;
          message = `Chute inhabituellement élevée : ${priceData.change.toFixed(1)}%`;
        } else if (alert.alert_type === 'unusual_rise' && priceData.change > 20) {
          shouldTrigger = true;
          message = `Hausse anormale détectée : +${priceData.change.toFixed(1)}%`;
        }

        if (shouldTrigger) {
          triggered.push({ ...alert, message, current_price: price });
          // Mark as triggered
          await sbFetch(`/alerts?id=eq.${alert.id}`, {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: JSON.stringify({ triggered_at: new Date().toISOString() })
          });
        }
      }
      return res.status(200).json({ triggered });
    }
  }

  // DELETE — remove alert
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    await sbFetch(`/alerts?id=eq.${id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ is_active: false })
    });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
