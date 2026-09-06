/**
 * In-memory ledger cache for instant proof availability
 */
const ledgerMap = new Map();

const saveToLedger = (proofId, proofDoc) => {
  if (!proofId) return;
  ledgerMap.set(proofId, {
    ...proofDoc,
    storedAt: new Date().toISOString(),
  });
};

const getLedgerProof = (proofId) => {
  return ledgerMap.get(proofId) || null;
};

module.exports = {
  saveToLedger,
  getLedgerProof,
};
