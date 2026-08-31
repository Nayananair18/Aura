/**
 * In-memory ledger cache to guarantee proof persistence
 * across requests even if MongoDB encounters network latency or reconnects.
 */
const inMemoryLedger = new Map();

const normalizeKey = (id) => {
  if (!id || typeof id !== 'string') return '';
  let clean = id.trim().toUpperCase();
  if (clean.includes('/VERIFY/')) {
    const parts = clean.split('/VERIFY/');
    clean = parts[parts.length - 1].trim();
  } else if (clean.includes('/')) {
    const parts = clean.split('/');
    clean = parts[parts.length - 1].trim();
  }
  return clean.replace(/^['"\s]+|['"\s]+$/g, '');
};

const saveToLedger = (proofId, proofDoc) => {
  if (!proofId || !proofDoc) return;
  const key = normalizeKey(proofId);
  const baseKey = key.replace(/^AURA-/, '');
  inMemoryLedger.set(key, proofDoc);
  inMemoryLedger.set(baseKey, proofDoc);
  inMemoryLedger.set(`AURA-${baseKey}`, proofDoc);
};

const getFromLedger = (proofId) => {
  if (!proofId) return null;
  const key = normalizeKey(proofId);
  const baseKey = key.replace(/^AURA-/, '');

  if (inMemoryLedger.has(key)) return inMemoryLedger.get(key);
  if (inMemoryLedger.has(baseKey)) return inMemoryLedger.get(baseKey);
  if (inMemoryLedger.has(`AURA-${baseKey}`)) return inMemoryLedger.get(`AURA-${baseKey}`);

  // Prefix matching fallback for truncated IDs
  for (const [k, v] of inMemoryLedger.entries()) {
    if (k.startsWith(key) || k.startsWith(`AURA-${baseKey}`) || (baseKey && k.startsWith(baseKey))) {
      return v;
    }
  }

  return null;
};

const listLedgerIds = () => {
  return Array.from(inMemoryLedger.keys());
};

module.exports = {
  saveToLedger,
  getFromLedger,
  listLedgerIds,
  normalizeKey,
};
