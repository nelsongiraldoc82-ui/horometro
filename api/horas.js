import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const DEFAULT_CONFIG = {
  foodMin: 60,
  lunchMin: 30,
  workDays: 5,
  hourRate: 10,
  extraMult: 1.5,
  currency: '$'
};

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:5500'];
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  try {
    const { action, payload } = req.body || {};
    if (!action) return res.status(400).json({ error: 'Falta accion' });

    switch (action) {

      case 'getRecords': {
        const records = await redis.get('horometro_records') || [];
        return res.status(200).json({ records });
      }

      case 'saveRecord': {
        const { record } = payload;
        if (!record || !record.date || !record.start || !record.end) {
          return res.status(400).json({ error: 'Datos del registro incompletos' });
        }
        let records = await redis.get('horometro_records') || [];
        const idx = records.findIndex(r => r.date === record.date);
        if (idx >= 0) {
          record.id = records[idx].id;
          records[idx] = record;
        } else {
          record.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
          records.push(record);
        }
        await redis.set('horometro_records', records);
        return res.status(200).json({ ok: true, records });
      }

      case 'deleteRecord': {
        const { id } = payload;
        if (!id) return res.status(400).json({ error: 'Falta ID' });
        let records = await redis.get('horometro_records') || [];
        records = records.filter(r => r.id !== id);
        await redis.set('horometro_records', records);
        return res.status(200).json({ ok: true, records });
      }

      case 'getConfig': {
        const config = await redis.get('horometro_config') || { ...DEFAULT_CONFIG };
        return res.status(200).json({ config });
      }

      case 'saveConfig': {
        const { config } = payload;
        if (!config) return res.status(400).json({ error: 'Falta config' });
        await redis.set('horometro_config', config);
        return res.status(200).json({ ok: true });
      }

      case 'getMonths': {
        const months = await redis.get('horometro_months') || {};
        return res.status(200).json({ months });
      }

      case 'saveMonths': {
        const { months } = payload;
        if (!months) return res.status(400).json({ error: 'Falta months' });
        await redis.set('horometro_months', months);
        return res.status(200).json({ ok: true });
      }

      case 'clearAll': {
        await redis.del('horometro_records');
        await redis.del('horometro_config');
        await redis.del('horometro_months');
        return res.status(200).json({ ok: true });
      }

      case 'ping': {
        const t = Date.now();
        await redis.ping();
        return res.status(200).json({ pong: true, ms: Date.now() - t, provider: 'upstash' });
      }

      default:
        return res.status(400).json({ error: 'Accion no valida: ' + action });
    }
  } catch (err) {
    console.error('Error API:', err);
    return res.status(500).json({ error: err.message });
  }
}