/**
 * Off-main-thread search for Indian stock list (large datasets).
 * Uses token → sorted index postings + sorted intersection; substring fallback when needed.
 */

const MAX_RESULTS = 6000;

let rows = [];

function addToken(word, idx) {
  if (!word || word.length < 2) return;
  const w = String(word).toLowerCase();
  const arr = rows._tok.get(w);
  if (!arr) {
    rows._tok.set(w, [idx]);
    return;
  }
  const last = arr[arr.length - 1];
  if (last !== idx) arr.push(idx);
}

function intersectSorted(a, b) {
  if (!a?.length || !b?.length) return [];
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const x = a[i];
    const y = b[j];
    if (x === y) {
      out.push(x);
      i += 1;
      j += 1;
    } else if (x < y) i += 1;
    else j += 1;
  }
  return out;
}

function intersectMany(lists) {
  if (lists.length === 0) return [];
  let cur = lists[0];
  for (let k = 1; k < lists.length; k += 1) {
    cur = intersectSorted(cur, lists[k]);
    if (cur.length === 0) return [];
  }
  return cur;
}

function tokenizeQuery(q) {
  const s = String(q || '')
    .trim()
    .toLowerCase();
  if (!s) return [];
  const parts = s.split(/\s+/).filter((t) => t.length > 0);
  return parts;
}

function buildIndex() {
  const map = new Map();
  rows._tok = map;
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const t = r.t;
    const words = t.match(/[a-z0-9]+/gi);
    if (words) {
      for (const w of words) {
        addToken(w, i);
      }
    }
    if (r.p) addToken(String(r.p), i);
  }
}

function matchesRowFilters(r, f) {
  const { productKind, segment, exchange, expiry, instrumentType } = f;
  if (productKind !== 'all') {
    if (productKind === 'equity') {
      if (r.k !== 'equity') return false;
    } else if (r.k !== productKind) return false;
  }
  if (segment !== 'all' && r.seg !== segment) return false;
  if (exchange !== 'all' && r.ex !== exchange) return false;
  if (expiry !== 'all' && r.exp !== expiry) return false;
  if (instrumentType !== 'all' && r.inst !== instrumentType) return false;
  return true;
}

function filterIndices(indices, f) {
  const out = [];
  const cap = MAX_RESULTS * 2;
  for (let k = 0; k < indices.length && out.length < cap; k += 1) {
    const i = indices[k];
    const r = rows[i];
    if (!r) continue;
    if (matchesRowFilters(r, f)) out.push(i);
  }
  return out;
}

function searchIndices(q, filters) {
  const tokens = tokenizeQuery(q);

  if (tokens.length === 0) {
    const out = [];
    for (let i = 0; i < rows.length && out.length < MAX_RESULTS; i += 1) {
      if (matchesRowFilters(rows[i], filters)) out.push(i);
    }
    return out;
  }

  let candidate;
  {
    const tokMap = rows._tok;
    const lists = [];
    let missing = false;
    for (const tok of tokens) {
      const list = tokMap.get(tok);
      if (!list || list.length === 0) {
        missing = true;
        break;
      }
      lists.push(list);
    }
    if (!missing && lists.length > 0) {
      lists.sort((a, b) => a.length - b.length);
      candidate = intersectMany(lists);
      const full = tokens.join(' ');
      if (full.length >= 2) {
        candidate = candidate.filter((i) => rows[i].t.includes(full));
      }
    } else {
      const first = tokens[0];
      const baseList = tokMap.get(first);
      const full = tokens.join(' ');
      if (baseList && baseList.length > 0 && baseList.length < rows.length * 0.4) {
        candidate = baseList.filter((i) => rows[i].t.includes(full));
      } else {
        candidate = [];
        const step = 8000;
        for (let start = 0; start < rows.length; start += step) {
          const end = Math.min(start + step, rows.length);
          for (let i = start; i < end; i += 1) {
            if (rows[i].t.includes(full)) candidate.push(i);
            if (candidate.length >= MAX_RESULTS * 3) break;
          }
          if (candidate.length >= MAX_RESULTS * 3) break;
        }
      }
    }
  }

  let filtered = filterIndices(candidate, filters);
  if (filtered.length > MAX_RESULTS) filtered = filtered.slice(0, MAX_RESULTS);
  return filtered;
}

self.onmessage = (ev) => {
  const msg = ev.data || {};
  if (msg.type === 'REINDEX') {
    const payload = msg.payload || {};
    const list = Array.isArray(payload.rows) ? payload.rows : [];
    rows = list;
    buildIndex();
    self.postMessage({ type: 'READY', count: rows.length });
    return;
  }
  if (msg.type === 'SEARCH') {
    const { query, filters, seq } = msg.payload || {};
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const indices = searchIndices(query || '', filters || {});
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    self.postMessage({ type: 'RESULT', indices, ms, count: indices.length, seq: seq ?? 0 });
  }
};
