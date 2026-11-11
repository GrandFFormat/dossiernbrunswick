// Sert le flux RSS de DossierNBrunswick (/feed.xml, réécrit vers /api/feed par vercel.json) ET
// compte chaque lecture : un flux est du XML lu par des machines, Vercel Analytics ne le voit jamais.
//
// Le flux est PUBLIC : DossierNBrunswick n'a pas d'abonnement. (La version copiée de DossierQuébec
// servait l'avis « flux réservé aux abonné·e·s » de DossierQuébec : retirée le 11 nov. 2026.)
//
// Le XML est généré par scrapers/build-news-data.js dans api/feed-data.xml, un chemin que Vercel ne
// sert pas, et embarqué ici par « includeFiles » (vercel.json).
//
// CE QU'ON ENREGISTRE : la date et le User-Agent, rien d'autre. Ni adresse IP, ni cookie.
// LE COMPTAGE NE DOIT JAMAIS CASSER LE FLUX : variables absentes ou Supabase en erreur, on sert.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const XML_PATH = join(process.cwd(), 'api', 'feed-data.xml');

async function compter(req) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const ua = String(req.headers['user-agent'] || '').slice(0, 300);
  const m = ua.match(/(\d+)\s+subscribers?/i);
  await fetch(`${url}/rest/v1/feed_hits`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ ua: `[NB] ${ua}`.slice(0, 300), abonnes: m ? Number(m[1]) : null }),
    signal: AbortSignal.timeout(800),
  });
}

export default async function handler(req, res) {
  let xml;
  try {
    xml = readFileSync(XML_PATH, 'utf8');
  } catch (e) {
    console.error('feed :', e.message);
    return res.status(500).send('Flux indisponible.');
  }
  try { await compter(req); } catch { /* volontairement silencieux */ }
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).send(xml);
}
