/**
 * Advanced NLP Analysis for Keyword Research
 *
 * Uses data science techniques:
 * - TF-IDF for keyword extraction
 * - N-gram analysis for phrase detection
 * - BM25 scoring for relevance
 * - Keyword clustering using cosine similarity
 * - Embedding-based semantic grouping (OpenAI)
 * - Topic modeling (LDA-inspired)
 */

import type OpenAI from 'openai';
import { keywordLLM, type KeywordLLM } from './llm.js';

// Stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'shall', 'can', 'need', 'dare', 'ought', 'used', 'it', 'its', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who',
  'whom', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once',
  'your', 'our', 'their', 'my', 'his', 'her', 'about', 'after', 'before', 'between',
  'into', 'through', 'during', 'above', 'below', 'up', 'down', 'out', 'off', 'over',
  'under', 'again', 'further', 'any', 'if', 'because', 'until', 'while', 'get', 'got',
  'getting', 'us', 'them', 'me', 'him', 'one', 'two', 'three', 'first', 'second',
]);

export interface TFIDFResult {
  term: string;
  tf: number;
  idf: number;
  tfidf: number;
  documentFrequency: number;
}

export interface NGram {
  phrase: string;
  frequency: number;
  words: number;
}

export interface KeywordCluster {
  id: number;
  name: string;
  keywords: string[];
  centroid?: number[];
  coherenceScore: number;
}

export interface TopicModel {
  topics: Array<{
    id: number;
    name: string;
    keywords: string[];
    weight: number;
  }>;
  documentTopicDistribution: Array<{
    documentId: number;
    topicWeights: number[];
  }>;
}

export interface NLPAnalysisResult {
  tfidfKeywords: TFIDFResult[];
  ngrams: {
    unigrams: NGram[];
    bigrams: NGram[];
    trigrams: NGram[];
  };
  clusters: KeywordCluster[];
  topics: TopicModel;
  entityPhrases: string[];
  semanticGroups: Array<{
    theme: string;
    keywords: string[];
  }>;
}

/**
 * Tokenize text into words
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .map((word) => word.replace(/^['"-]+|['"-]+$/g, ''));
}

/**
 * Calculate Term Frequency (TF)
 */
export function calculateTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const totalTerms = tokens.length;

  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  // Normalize by document length
  for (const [term, count] of tf) {
    tf.set(term, count / totalTerms);
  }

  return tf;
}

/**
 * Calculate Inverse Document Frequency (IDF)
 */
export function calculateIDF(documents: string[][]): Map<string, number> {
  const idf = new Map<string, number>();
  const N = documents.length;
  const documentFrequency = new Map<string, number>();

  // Count document frequency for each term
  for (const doc of documents) {
    const uniqueTerms = new Set(doc);
    for (const term of uniqueTerms) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }

  // Calculate IDF: log(N / df)
  for (const [term, df] of documentFrequency) {
    idf.set(term, Math.log(N / df) + 1); // +1 smoothing
  }

  return idf;
}

/**
 * Calculate TF-IDF for a corpus
 */
export function calculateTFIDF(documents: string[]): TFIDFResult[] {
  const tokenizedDocs = documents.map(tokenize);
  const idf = calculateIDF(tokenizedDocs);

  const results: TFIDFResult[] = [];
  const globalTF = new Map<string, number>();
  const totalTokens = tokenizedDocs.flat().length;

  // Aggregate TF across all documents
  for (const doc of tokenizedDocs) {
    for (const token of doc) {
      globalTF.set(token, (globalTF.get(token) || 0) + 1);
    }
  }

  // Calculate TF-IDF for each term
  for (const [term, count] of globalTF) {
    const tf = count / totalTokens;
    const idfValue = idf.get(term) || 1;
    const tfidf = tf * idfValue;

    // Count document frequency
    const df = tokenizedDocs.filter((doc) => doc.includes(term)).length;

    results.push({
      term,
      tf,
      idf: idfValue,
      tfidf,
      documentFrequency: df,
    });
  }

  // Sort by TF-IDF score
  return results.sort((a, b) => b.tfidf - a.tfidf);
}

/**
 * Extract N-grams from text
 */
export function extractNgrams(
  text: string,
  n: number,
  minFrequency: number = 2
): NGram[] {
  const tokens = tokenize(text);
  const ngrams = new Map<string, number>();

  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(' ');
    ngrams.set(gram, (ngrams.get(gram) || 0) + 1);
  }

  return Array.from(ngrams.entries())
    .filter(([_, freq]) => freq >= minFrequency)
    .map(([phrase, frequency]) => ({
      phrase,
      frequency,
      words: n,
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * BM25 scoring for keyword relevance
 * BM25 is a bag-of-words retrieval function that ranks documents by relevance
 */
export function calculateBM25(
  documents: string[],
  query: string,
  k1: number = 1.5,
  b: number = 0.75
): Array<{ docIndex: number; score: number }> {
  const tokenizedDocs = documents.map(tokenize);
  const queryTokens = tokenize(query);
  const avgDocLength = tokenizedDocs.reduce((sum, doc) => sum + doc.length, 0) / tokenizedDocs.length;
  const N = documents.length;

  // Calculate document frequency for query terms
  const df = new Map<string, number>();
  for (const term of queryTokens) {
    df.set(term, tokenizedDocs.filter((doc) => doc.includes(term)).length);
  }

  const scores: Array<{ docIndex: number; score: number }> = [];

  for (let i = 0; i < tokenizedDocs.length; i++) {
    const doc = tokenizedDocs[i];
    let score = 0;

    for (const term of queryTokens) {
      const termFreq = doc.filter((t) => t === term).length;
      const docFreq = df.get(term) || 0;

      if (docFreq === 0) continue;

      // IDF component
      const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);

      // TF component with length normalization
      const tfNorm =
        (termFreq * (k1 + 1)) /
        (termFreq + k1 * (1 - b + b * (doc.length / avgDocLength)));

      score += idf * tfNorm;
    }

    scores.push({ docIndex: i, score });
  }

  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * K-Means clustering for keywords
 */
export function kMeansClustering(
  vectors: number[][],
  k: number,
  maxIterations: number = 100
): number[] {
  if (vectors.length === 0 || k <= 0) return [];
  if (vectors.length <= k) return vectors.map((_, i) => i);

  const dim = vectors[0].length;

  // Initialize centroids randomly
  const centroids: number[][] = [];
  const usedIndices = new Set<number>();
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * vectors.length);
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx);
      centroids.push([...vectors[idx]]);
    }
  }

  let assignments: number[] = new Array(vectors.length).fill(0);
  let changed = true;
  let iterations = 0;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Assign points to nearest centroid
    for (let i = 0; i < vectors.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;

      for (let j = 0; j < k; j++) {
        const dist = 1 - cosineSimilarity(vectors[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = j;
        }
      }

      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    // Update centroids
    for (let j = 0; j < k; j++) {
      const clusterPoints = vectors.filter((_, i) => assignments[i] === j);
      if (clusterPoints.length === 0) continue;

      for (let d = 0; d < dim; d++) {
        centroids[j][d] = clusterPoints.reduce((sum, p) => sum + p[d], 0) / clusterPoints.length;
      }
    }
  }

  return assignments;
}

/**
 * Create term vectors for clustering (bag of words)
 */
export function createTermVectors(
  keywords: string[],
  vocabulary: string[]
): number[][] {
  const vocabIndex = new Map<string, number>();
  vocabulary.forEach((word, i) => vocabIndex.set(word, i));

  return keywords.map((keyword) => {
    const vector = new Array(vocabulary.length).fill(0);
    const tokens = tokenize(keyword);
    for (const token of tokens) {
      const idx = vocabIndex.get(token);
      if (idx !== undefined) {
        vector[idx] = 1;
      }
    }
    return vector;
  });
}

/** An OpenAI client, or any function returning one embedding per text (llm.ts). */
export type Embedder = OpenAI | ((texts: string[]) => Promise<number[][]>);

async function embedBatch(embedder: Embedder, batch: string[]): Promise<number[][]> {
  if (typeof embedder === 'function') return embedder(batch);
  const response = await embedder.embeddings.create({ model: 'text-embedding-3-small', input: batch });
  return response.data.map((item) => item.embedding);
}

/**
 * Get embeddings for semantic clustering
 */
export async function getEmbeddings(
  texts: string[],
  openai: Embedder
): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Process in batches of 100 (OpenAI limit)
  const batchSize = 100;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    try {
      embeddings.push(...(await embedBatch(openai, batch)));
    } catch (error) {
      // Fallback: create simple bag-of-words vectors
      console.warn('Embedding API failed, using fallback BOW vectors');
      for (const text of batch) {
        const tokens = tokenize(text);
        const vector = new Array(1536).fill(0); // Match embedding dimension
        for (const token of tokens) {
          const hash = simpleHash(token) % 1536;
          vector[hash] = 1;
        }
        embeddings.push(vector);
      }
    }
  }

  return embeddings;
}

/**
 * Simple hash function for fallback vectors
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Cluster keywords using embeddings
 */
export async function clusterKeywordsByEmbedding(
  keywords: string[],
  openai: Embedder,
  numClusters?: number
): Promise<KeywordCluster[]> {
  if (keywords.length === 0) return [];

  // Get embeddings
  const embeddings = await getEmbeddings(keywords, openai);

  // Determine optimal number of clusters (elbow method approximation)
  const k = numClusters || Math.min(Math.max(3, Math.floor(keywords.length / 5)), 10);

  // Run K-means
  const assignments = kMeansClustering(embeddings, k);

  // Group keywords by cluster
  const clusters: KeywordCluster[] = [];
  for (let i = 0; i < k; i++) {
    const clusterKeywords = keywords.filter((_, j) => assignments[j] === i);
    if (clusterKeywords.length === 0) continue;

    // Calculate centroid
    const clusterEmbeddings = embeddings.filter((_, j) => assignments[j] === i);
    const centroid = clusterEmbeddings[0].map((_, d) =>
      clusterEmbeddings.reduce((sum, e) => sum + e[d], 0) / clusterEmbeddings.length
    );

    // Calculate coherence (average pairwise similarity)
    let coherence = 1;
    if (clusterEmbeddings.length > 1) {
      let totalSim = 0;
      let pairs = 0;
      for (let j = 0; j < clusterEmbeddings.length; j++) {
        for (let l = j + 1; l < clusterEmbeddings.length; l++) {
          totalSim += cosineSimilarity(clusterEmbeddings[j], clusterEmbeddings[l]);
          pairs++;
        }
      }
      coherence = pairs > 0 ? totalSim / pairs : 1;
    }

    // Generate cluster name from most common terms
    const allTokens = clusterKeywords.flatMap(tokenize);
    const tokenFreq = new Map<string, number>();
    for (const token of allTokens) {
      tokenFreq.set(token, (tokenFreq.get(token) || 0) + 1);
    }
    const topTokens = Array.from(tokenFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);

    clusters.push({
      id: i,
      name: topTokens.join(' + '),
      keywords: clusterKeywords,
      centroid,
      coherenceScore: coherence,
    });
  }

  return clusters.sort((a, b) => b.coherenceScore - a.coherenceScore);
}

/**
 * Extract entity-like phrases (capitalized sequences, proper nouns)
 */
export function extractEntityPhrases(text: string): string[] {
  const entities = new Set<string>();

  // Match capitalized word sequences (potential proper nouns/entities)
  const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  let match;
  while ((match = capitalizedPattern.exec(text)) !== null) {
    const phrase = match[1];
    if (phrase.length > 2 && !STOP_WORDS.has(phrase.toLowerCase())) {
      entities.add(phrase);
    }
  }

  // Match quoted phrases
  const quotedPattern = /"([^"]+)"/g;
  while ((match = quotedPattern.exec(text)) !== null) {
    const phrase = match[1].trim();
    if (phrase.length > 2 && phrase.length < 50) {
      entities.add(phrase);
    }
  }

  return Array.from(entities);
}

/**
 * Simplified LDA-inspired topic modeling
 * Groups keywords by co-occurrence patterns
 */
export function extractTopics(
  documents: string[],
  numTopics: number = 5
): TopicModel {
  const tokenizedDocs = documents.map(tokenize);

  // Build co-occurrence matrix
  const cooccurrence = new Map<string, Map<string, number>>();
  const termFreq = new Map<string, number>();

  for (const doc of tokenizedDocs) {
    const uniqueTerms = [...new Set(doc)];

    // Count term frequency
    for (const term of doc) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }

    // Count co-occurrences
    for (let i = 0; i < uniqueTerms.length; i++) {
      for (let j = i + 1; j < uniqueTerms.length; j++) {
        const t1 = uniqueTerms[i];
        const t2 = uniqueTerms[j];

        if (!cooccurrence.has(t1)) cooccurrence.set(t1, new Map());
        if (!cooccurrence.has(t2)) cooccurrence.set(t2, new Map());

        cooccurrence.get(t1)!.set(t2, (cooccurrence.get(t1)!.get(t2) || 0) + 1);
        cooccurrence.get(t2)!.set(t1, (cooccurrence.get(t2)!.get(t1) || 0) + 1);
      }
    }
  }

  // Get top terms by frequency
  const topTerms = Array.from(termFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([term]) => term);

  // Create simple topics based on highest co-occurrence clusters
  const usedTerms = new Set<string>();
  const topics: Array<{
    id: number;
    name: string;
    keywords: string[];
    weight: number;
  }> = [];

  for (let topicId = 0; topicId < numTopics && usedTerms.size < topTerms.length; topicId++) {
    // Find highest-frequency unused term as seed
    const seedTerm = topTerms.find((t) => !usedTerms.has(t));
    if (!seedTerm) break;

    usedTerms.add(seedTerm);
    const topicKeywords = [seedTerm];

    // Add co-occurring terms
    const cooccurMap = cooccurrence.get(seedTerm);
    if (cooccurMap) {
      const cooccurTerms = Array.from(cooccurMap.entries())
        .filter(([term]) => !usedTerms.has(term))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7);

      for (const [term] of cooccurTerms) {
        topicKeywords.push(term);
        usedTerms.add(term);
      }
    }

    topics.push({
      id: topicId,
      name: topicKeywords.slice(0, 3).join(', '),
      keywords: topicKeywords,
      weight: termFreq.get(seedTerm) || 0,
    });
  }

  // Calculate document-topic distribution
  const documentTopicDistribution = tokenizedDocs.map((doc, docId) => {
    const docTerms = new Set(doc);
    const topicWeights = topics.map((topic) => {
      const overlap = topic.keywords.filter((kw) => docTerms.has(kw)).length;
      return overlap / topic.keywords.length;
    });

    return {
      documentId: docId,
      topicWeights,
    };
  });

  return {
    topics: topics.sort((a, b) => b.weight - a.weight),
    documentTopicDistribution,
  };
}

/**
 * Run full NLP analysis on content
 */
export async function runNLPAnalysis(
  content: string | string[],
  options: {
    /** Embeddings come from here when it has them (see llm.ts); or an OpenAI key, as before. */
    llm?: KeywordLLM;
    openaiApiKey?: string;
    numClusters?: number;
    numTopics?: number;
  } = {}
): Promise<NLPAnalysisResult> {
  const documents = Array.isArray(content) ? content : [content];
  const combinedText = documents.join(' ');

  // TF-IDF analysis
  const tfidfKeywords = calculateTFIDF(documents).slice(0, 100);

  // N-gram extraction
  const unigrams = extractNgrams(combinedText, 1, 3);
  const bigrams = extractNgrams(combinedText, 2, 2);
  const trigrams = extractNgrams(combinedText, 3, 2);

  // Topic modeling
  const topics = extractTopics(documents, options.numTopics || 5);

  // Entity extraction
  const entityPhrases = extractEntityPhrases(combinedText);

  // Keyword clustering (with embeddings if API key provided)
  let clusters: KeywordCluster[] = [];
  const keywordsToCluster = tfidfKeywords.slice(0, 50).map((k) => k.term);

  const embed = keywordLLM(options)?.embed;
  if (embed && keywordsToCluster.length > 0) {
    try {
      clusters = await clusterKeywordsByEmbedding(
        keywordsToCluster,
        (texts) => embed(texts),
        options.numClusters
      );
    } catch (error) {
      console.warn('Embedding clustering failed, using fallback');
    }
  }

  // Fallback clustering using term vectors
  if (clusters.length === 0 && keywordsToCluster.length > 0) {
    const vocabulary = [...new Set(keywordsToCluster.flatMap(tokenize))];
    const vectors = createTermVectors(keywordsToCluster, vocabulary);
    const k = Math.min(5, Math.max(2, Math.floor(keywordsToCluster.length / 5)));
    const assignments = kMeansClustering(vectors, k);

    for (let i = 0; i < k; i++) {
      const clusterKws = keywordsToCluster.filter((_, j) => assignments[j] === i);
      if (clusterKws.length === 0) continue;

      const allTokens = clusterKws.flatMap(tokenize);
      const tokenFreq = new Map<string, number>();
      for (const token of allTokens) {
        tokenFreq.set(token, (tokenFreq.get(token) || 0) + 1);
      }
      const topTokens = Array.from(tokenFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([t]) => t);

      clusters.push({
        id: i,
        name: topTokens.join(' + '),
        keywords: clusterKws,
        coherenceScore: 0.5,
      });
    }
  }

  // Semantic groups from topics
  const semanticGroups = topics.topics.map((topic) => ({
    theme: topic.name,
    keywords: topic.keywords,
  }));

  return {
    tfidfKeywords,
    ngrams: {
      unigrams,
      bigrams,
      trigrams,
    },
    clusters,
    topics,
    entityPhrases,
    semanticGroups,
  };
}
