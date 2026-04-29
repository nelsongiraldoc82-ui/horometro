import { kv } from '@vercel/kv';

// Configuración por defecto
const DEFAULT_CONFIG = {
  foodMin: 60,
  lunchMin: 30,
  workDays: 5,
  hourRate: 10,
  extraMult: 1.5,
  currency: '$'
};

export default async function handler(req, res) {
  // CORS para desarrollo local
  const origin = req.headers.origin || '';
  const allowedOrigins = ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:5500'];
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { action, payload } = req.body || {};

    if (!action) {
      return res.status(400).json({ error: 'Falta el campo "action"' });
    }

    switch (action) {

      // ── REGISTROS ──
      case 'getRecords': {
        const records = await kv.get('horometro_records') || [];
        return res.status(200).json({ records });
      }

      case 'saveRecord': {
        const { record } = payload;
        if (!record || !record.date || !record.start || !record.end) {
          return res.status(400).json({ error: 'Datos del registro incompletos' });
        }
        let records = await kv.get('horometro_records') || [];
        // Si ya existe registro para esa fecha, reemplazar
        const idx = records.findIndex(r => r.date === record.date);
        if (idx >= 0) {
          record.id = records[idx].id;
          records[idx] = record;
        } else {
          record.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
          records.push(record);
        }
        await kv.set('horometro_records', records);
        return res.status(200).json({ ok: true, records });
      }

      case 'deleteRecord': {
        const { id } = payload;
        if (!id) return res.status(400).json({ error: 'Falta ID' });
        let records = await kv.get('horometro_records') || [];
        records = records.filter(r => r.id !== id);
        await kv.set('horometro_records', records);
        return res.status(200).json({ ok: true, records });
      }

      // ── CONFIGURACIÓN ──
      case 'getConfig': {
        const config = await kv.get('horometro_config') || { ...DEFAULT_CONFIG };
        return res.status(200).json({ config });
      }

      case 'saveConfig': {
        const { config } = payload;
        if (!config) return res.status(400).json({ error: 'Falta config' });
        await kv.set('horometro_config', config);
        return res.status(200).json({ ok: true });
      }

      // ── HORAS POR MES ──
      case 'getMonths': {
        const months = await kv.get('horometro_months') || {};
        return res.status(200).json({ months });
      }

      case 'saveMonths': {
        const { months } = payload;
        if (!months) return res.status(400).json({ error: 'Falta months' });
        await kv.set('horometro_months', months);
        return res.status(200).json({ ok: true });
      }

      // ── LIMPIAR TODO ──
      case 'clearAll': {
        await kv.del('horometro_records');
        await kv.del('horometro_config');
        await kv.del('horometro_months');
        return res.status(200).json({ ok: true });
      }

      // ── HEALTH CHECK ──
      case 'ping': {
        return res.status(200).json({ pong: true, time: new Date().toISOString() });
      }

      default:
        return res.status(400).json({ error: `Acción no válida: ${action}` });
    }

  } catch (err) {
    console.error('Error en API:', err);
    return res.status(500).json({ error: err.message });
  }
}