/** Counts elapsed viewing time, excluding seeks, stalls, pauses and hidden tabs. */
export class WatchClock {
  private previous: { wall: number; media: number } | undefined;
  reset() { this.previous = undefined; }
  sample(wall: number, media: number, rate: number, active: boolean) {
    const previous = this.previous;
    this.previous = active ? { wall, media } : undefined;
    if (!active || !previous || rate <= 0) return 0;
    const elapsed = (wall - previous.wall) / 1000;
    const advanced = (media - previous.media) / rate;
    if (elapsed <= 0 || elapsed > 2 || advanced <= 0 || advanced > elapsed + 0.35) return 0;
    return Math.min(elapsed, advanced);
  }
}
