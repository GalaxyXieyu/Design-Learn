const DEFAULT_K1 = 1.5;
const DEFAULT_B = 0.75;

class BM25 {
  constructor(options = {}) {
    this.k1 = Number.isFinite(options.k1) ? options.k1 : DEFAULT_K1;
    this.b = Number.isFinite(options.b) ? options.b : DEFAULT_B;
    this.corpus = [];
    this.termFrequencies = [];
    this.docLengths = [];
    this.avgdl = 0;
    this.idf = new Map();
    this.N = 0;
  }

  tokenize(text) {
    const normalized = String(text ?? '')
      .toLowerCase()
      // 保留 Unicode 字母/数字 + 空白，避免中文被直接清空
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .trim();

    if (!normalized) return [];

    const tokens = [];
    for (const raw of normalized.split(/\s+/)) {
      if (!raw) continue;

      // CJK 词：拆成 2-gram，提升“按钮/表单”等短词的可用性
      if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(raw)) {
        if (raw.length === 1) {
          tokens.push(raw);
          continue;
        }
        for (let i = 0; i < raw.length - 1; i += 1) {
          tokens.push(raw.slice(i, i + 2));
        }
        continue;
      }

      // 英文/数字：允许 2 字符（如 ui/ux/cta）
      if (raw.length >= 2) tokens.push(raw);
    }

    return tokens;
  }

  fit(documents) {
    if (!Array.isArray(documents) || documents.length === 0) {
      this.N = 0;
      return;
    }

    this.corpus = documents.map((doc) => this.tokenize(doc));
    this.N = this.corpus.length;
    this.docLengths = this.corpus.map((tokens) => tokens.length);
    this.avgdl = this.docLengths.reduce((sum, len) => sum + len, 0) / this.N;

    const docFreqs = new Map();
    this.termFrequencies = this.corpus.map((tokens) => {
      const frequencies = new Map();
      const seen = new Set();
      for (const token of tokens) {
        frequencies.set(token, (frequencies.get(token) || 0) + 1);
        if (!seen.has(token)) {
          docFreqs.set(token, (docFreqs.get(token) || 0) + 1);
          seen.add(token);
        }
      }
      return frequencies;
    });

    this.idf = new Map();
    for (const [token, freq] of docFreqs.entries()) {
      const idf = Math.log((this.N - freq + 0.5) / (freq + 0.5) + 1);
      this.idf.set(token, idf);
    }
  }

  score(query) {
    if (this.N === 0) {
      return [];
    }

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const scored = [];
    const avgdl = this.avgdl || 1;
    for (let index = 0; index < this.corpus.length; index += 1) {
      const docLen = this.docLengths[index] || 0;
      const frequencies = this.termFrequencies[index];
      let score = 0;

      for (const token of queryTokens) {
        const idf = this.idf.get(token);
        if (idf === undefined) {
          continue;
        }
        const tf = frequencies.get(token) || 0;
        if (tf === 0) {
          continue;
        }
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + (this.b * docLen) / avgdl);
        score += idf * (numerator / denominator);
      }

      scored.push([index, score]);
    }

    scored.sort((a, b) => b[1] - a[1]);
    return scored;
  }
}

module.exports = {
  BM25,
};
