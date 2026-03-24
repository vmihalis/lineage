/**
 * ContextBudget -- Tracks context consumption as a 0-1 percentage of effective capacity.
 *
 * The core metaphor: token consumption IS aging. Every token consumed brings a citizen
 * closer to death. The safety buffer ensures the agent can finish its final transmission
 * before context exhaustion.
 */

export interface ContextThreshold {
  /** Percentage level (0-1) at which this threshold triggers */
  percentage: number;
  /** Human-readable label, e.g. 'peak-transmission', 'decline-warning', 'death' */
  label: string;
}

export interface ContextBudgetConfig {
  /** Total tokens available (from model context window) */
  contextWindow: number;
  /** Fraction 0-1 reserved as safety buffer (default 0.20) */
  safetyBuffer: number;
  /** Thresholds that fire callbacks when crossed */
  thresholds: ContextThreshold[];
}

export class ContextBudget {
  private consumedTokens = 0;
  private readonly _effectiveCapacity: number;
  private readonly thresholds: ContextThreshold[];
  private triggeredThresholds = new Set<string>();

  constructor(config: ContextBudgetConfig) {
    this._effectiveCapacity = config.contextWindow * (1 - config.safetyBuffer);
    // Sort thresholds ascending by percentage for ordered triggering
    this.thresholds = [...config.thresholds].sort(
      (a, b) => a.percentage - b.percentage,
    );
  }

  /**
   * Record consumed tokens and check for threshold crossings.
   * Returns array of newly triggered thresholds (may be empty).
   */
  update(inputTokens: number, outputTokens: number): ContextThreshold[] {
    this.consumedTokens += inputTokens + outputTokens;
    const currentPercentage = this.percentage;
    const newlyTriggered: ContextThreshold[] = [];

    for (const threshold of this.thresholds) {
      if (
        currentPercentage >= threshold.percentage &&
        !this.triggeredThresholds.has(threshold.label)
      ) {
        this.triggeredThresholds.add(threshold.label);
        newlyTriggered.push(threshold);
      }
    }

    return newlyTriggered;
  }

  /** Context consumption as a 0-1 percentage, clamped to 1.0 */
  get percentage(): number {
    return Math.min(this.consumedTokens / this._effectiveCapacity, 1.0);
  }

  /** Total usable tokens (contextWindow minus safety buffer) */
  get effectiveCapacity(): number {
    return this._effectiveCapacity;
  }

  /** Tokens remaining before hitting effective capacity, never below 0 */
  get remainingTokens(): number {
    return Math.max(this._effectiveCapacity - this.consumedTokens, 0);
  }

  /** Reset all tracking state (consumed tokens and triggered thresholds) */
  reset(): void {
    this.consumedTokens = 0;
    this.triggeredThresholds.clear();
  }
}
