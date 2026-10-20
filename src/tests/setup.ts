// Environnement minimal pour exécuter les modules sous Node : localStorage en mémoire (les stores y accèdent au chargement).
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  get length() { return mem.size; },
  clear: () => mem.clear(),
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  key: (i: number) => [...mem.keys()][i] ?? null,
  removeItem: (k: string) => { mem.delete(k); },
  setItem: (k: string, v: string) => { mem.set(k, String(v)); },
};
