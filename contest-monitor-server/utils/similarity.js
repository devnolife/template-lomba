const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Winnowing algorithm for code fingerprinting
// ---------------------------------------------------------------------------
// Winnowing produces a set of position-independent hashes (fingerprints) for
// a document.  Two documents with a high Jaccard similarity between their
// fingerprint sets are likely to share large blocks of identical text.
//
// Reference: Schleimer, Wilkerson, Aiken — "Winnowing: Local Algorithms for
//            Document Fingerprinting" (SIGMOD 2003)
// ---------------------------------------------------------------------------

const DEFAULT_K = 25; // k-gram size (characters)
const DEFAULT_W = 4; // window size for winnowing

/**
 * Normalise source code so that superficial formatting differences (whitespace,
 * casing, blank lines, single-line comments) don't affect fingerprints.
 *
 * @param {string} code
 * @returns {string}
 */
function normalise(code) {
  return (
    code
      // Strip single-line comments ( // ... )
      .replace(/\/\/.*$/gm, "")
      // Strip block comments ( /* ... */ )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Strip Python-style comments ( # ... )
      .replace(/#.*$/gm, "")
      // Collapse all whitespace to a single space
      .replace(/\s+/g, " ")
      // Lowercase
      .toLowerCase()
      .trim()
  );
}

/**
 * Generate k-gram hashes from a string.
 * @param {string} text  – normalised text
 * @param {number} k     – gram size
 * @returns {number[]}
 */
function kgramHashes(text, k = DEFAULT_K) {
  const hashes = [];
  if (text.length < k) {
    // Text shorter than k — hash the whole thing
    hashes.push(simpleHash(text));
    return hashes;
  }
  for (let i = 0; i <= text.length - k; i++) {
    hashes.push(simpleHash(text.slice(i, i + k)));
  }
  return hashes;
}

/**
 * Fast non-cryptographic hash (FNV-1a 32-bit).
 * @param {string} str
 * @returns {number}
 */
function simpleHash(str) {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime, keep 32-bit unsigned
  }
  return hash;
}

/**
 * SHA-256 of a string (for content-addressable storage).
 * @param {string} text
 * @returns {string}
 */
function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Select fingerprints using the winnowing algorithm.
 * @param {number[]} hashes – k-gram hash array
 * @param {number} w        – window size
 * @returns {Set<number>}   – selected fingerprint hashes
 */
function winnow(hashes, w = DEFAULT_W) {
  const fingerprints = new Set();
  if (hashes.length === 0) return fingerprints;
  if (hashes.length <= w) {
    // Entire array fits in one window — pick the minimum
    fingerprints.add(Math.min(...hashes));
    return fingerprints;
  }

  let prevMin = -1;
  for (let i = 0; i <= hashes.length - w; i++) {
    const window = hashes.slice(i, i + w);
    let minVal = window[0];
    for (let j = 1; j < window.length; j++) {
      if (window[j] < minVal) minVal = window[j];
    }
    if (minVal !== prevMin) {
      fingerprints.add(minVal);
      prevMin = minVal;
    }
  }

  return fingerprints;
}

/**
 * Generate a fingerprint set for a piece of source code.
 *
 * @param {string} code – raw source code
 * @param {number} [k]  – k-gram size
 * @param {number} [w]  – window size
 * @returns {{ fingerprints: Set<number>, hash: string, normLength: number }}
 */
function fingerprint(code, k = DEFAULT_K, w = DEFAULT_W) {
  const norm = normalise(code);
  const hashes = kgramHashes(norm, k);
  const fps = winnow(hashes, w);
  return {
    fingerprints: fps,
    hash: sha256(norm),
    normLength: norm.length,
  };
}

/**
 * Jaccard similarity between two fingerprint sets.
 * @param {Set<number>} a
 * @param {Set<number>} b
 * @returns {number} 0..1
 */
function jaccardSimilarity(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const v of a) {
    if (b.has(v)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Compare two code strings and return a similarity score [0..1].
 *
 * @param {string} code1
 * @param {string} code2
 * @returns {{ similarity: number, hash1: string, hash2: string, identicalContent: boolean }}
 */
function compareCode(code1, code2) {
  const fp1 = fingerprint(code1);
  const fp2 = fingerprint(code2);

  const identicalContent = fp1.hash === fp2.hash;
  const similarity = identicalContent
    ? 1.0
    : Math.round(jaccardSimilarity(fp1.fingerprints, fp2.fingerprints) * 1000) /
      1000;

  return {
    similarity,
    hash1: fp1.hash,
    hash2: fp2.hash,
    identicalContent,
  };
}

/**
 * Compare multiple repositories' file sets pairwise.
 *
 * @param {{ repoId: string, files: { path: string, content: string }[] }[]} repos
 * @param {number} [threshold=0.8] – minimum similarity to flag
 * @returns {{ repo1: string, repo2: string, file: string, similarity: number }[]}
 */
function crossCompareRepos(repos, threshold = 0.8) {
  const flags = [];

  // Build fingerprint index: repoId -> path -> fingerprint
  const index = new Map();
  for (const repo of repos) {
    const fpMap = new Map();
    for (const file of repo.files) {
      fpMap.set(file.path, fingerprint(file.content));
    }
    index.set(repo.repoId, fpMap);
  }

  // Pairwise comparison
  const repoIds = [...index.keys()];
  for (let i = 0; i < repoIds.length; i++) {
    for (let j = i + 1; j < repoIds.length; j++) {
      const mapA = index.get(repoIds[i]);
      const mapB = index.get(repoIds[j]);

      for (const [pathA, fpA] of mapA) {
        for (const [pathB, fpB] of mapB) {
          // Only compare files that look like the same kind of file
          // (same extension or same base name)
          const extA = pathA.split(".").pop();
          const extB = pathB.split(".").pop();
          if (extA !== extB) continue;

          const sim = jaccardSimilarity(fpA.fingerprints, fpB.fingerprints);
          if (sim >= threshold) {
            flags.push({
              repo1: repoIds[i],
              repo2: repoIds[j],
              file1: pathA,
              file2: pathB,
              similarity: Math.round(sim * 1000) / 1000,
              identicalContent: fpA.hash === fpB.hash,
            });
          }
        }
      }
    }
  }

  // Sort by similarity descending
  flags.sort((a, b) => b.similarity - a.similarity);
  return flags;
}

module.exports = {
  normalise,
  fingerprint,
  jaccardSimilarity,
  compareCode,
  crossCompareRepos,
  sha256,
};
