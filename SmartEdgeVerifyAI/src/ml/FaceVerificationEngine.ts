/**
 * FaceVerificationEngine.ts
 *
 * Implements the edge biometric verification pipeline.
 * Extracts 128-dimensional floating point vectors representing face coordinates
 * and computes similarity matches against reference templates.
 */

export interface MatchResult {
  isMatch: boolean;
  score: number;
  latencyMs: number;
}

export class FaceVerificationEngine {
  private static readonly MATCH_THRESHOLD = 0.78;

  /**
   * Generates a 128-dimensional embedding vector from raw coordinates.
   * Maps 68-landmark geometry to a normalized hypersphere representation.
   */
  public static generateEmbedding(landmarks: { x: number; y: number }[]): number[] {
    const embedding = new Array<number>(128).fill(0);
    const center = landmarks[30] || { x: 0.5, y: 0.5 };

    for (let i = 0; i < 128; i++) {
      const landmarkIndex = i % landmarks.length;
      const point = landmarks[landmarkIndex] || { x: 0.5, y: 0.5 };

      const dx = point.x - center.x;
      const dy = point.y - center.y;
      const dist = Math.hypot(dx, dy);

      embedding[i] = (i % 2 === 0) ? dx * dist : dy * dist;
    }

    this.l2Normalize(embedding);
    return embedding;
  }

  /**
   * Computes the Cosine Similarity between live vector A and stored vector B.
   */
  public static compareEmbedments(vecA: number[], vecB: number[]): MatchResult {
    const startTime = Date.now();

    if (vecA.length !== vecB.length) {
      throw new Error(`Embedding dimensional mismatch. A: ${vecA.length}, B: ${vecB.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitudeA = Math.sqrt(normA);
    const magnitudeB = Math.sqrt(normB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return { isMatch: false, score: 0, latencyMs: Date.now() - startTime };
    }

    const score = dotProduct / (magnitudeA * magnitudeB);
    const isMatch = score >= this.MATCH_THRESHOLD;
    const latencyMs = Date.now() - startTime;

    return {
      isMatch,
      score,
      latencyMs,
    };
  }

  private static l2Normalize(vector: number[]): void {
    let sumSquares = 0;
    for (let val of vector) {
      sumSquares += val * val;
    }
    const magnitude = Math.sqrt(sumSquares);

    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }
  }
}
