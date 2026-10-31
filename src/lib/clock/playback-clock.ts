/**
 * The IFrame player only reports its position a few times per second.
 * This clock extrapolates between reports so lyrics move every frame,
 * and ignores tiny backwards corrections that would make words flicker.
 */
export class PlaybackClock {
  private lastRaw = -1;
  private anchorTime = 0;
  private anchorPerf = 0;
  private out = 0;
  playing = false;

  sample(raw: number) {
    const now = performance.now();
    if (raw !== this.lastRaw) {
      this.lastRaw = raw;
      this.anchorTime = raw;
      this.anchorPerf = now;
    }
    let t = this.anchorTime;
    if (this.playing) {
      // never extrapolate more than 1 s past the last report (stalls, buffering)
      t += Math.min(1, (now - this.anchorPerf) / 1000);
    }
    const backwards = this.out - t;
    if (this.playing && backwards > 0 && backwards < 0.25) t = this.out;
    this.out = t;
    return t;
  }

  reset(t = 0) {
    this.lastRaw = -1;
    this.anchorTime = t;
    this.anchorPerf = performance.now();
    this.out = t;
  }
}
