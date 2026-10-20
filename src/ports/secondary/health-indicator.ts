export interface HealthIndicator {
  readonly name: string;
  /** Resolve when healthy, reject otherwise. */
  check(): Promise<void>;
}
