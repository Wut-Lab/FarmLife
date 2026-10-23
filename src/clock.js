// Game clock: time of day, calendar, energy, and the end-of-day update.
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
export const DAYS_PER_SEASON = 28;
export const DAY_START = 6 * 60;  // 6:00 AM, in minutes
export const DAY_END = 26 * 60;   // 2:00 AM next morning
export const TICK_MINUTES = 10;
export const MAX_ENERGY = 100;

export class Clock {
  constructor({ msPerTick = 7000 } = {}) {
    this.msPerTick = msPerTick;
    this.minutes = DAY_START;
    this.day = 1;       // 1..28
    this.season = 0;    // index into SEASONS
    this.year = 1;
    this.energy = MAX_ENERGY;
    this.max = MAX_ENERGY; // raised by things you wear
    this.paused = false;
    this._acc = 0;
    this._listeners = {};
  }

  on(event, fn) { (this._listeners[event] ||= []).push(fn); return this; }
  _emit(event, data) { (this._listeners[event] || []).forEach(fn => fn(data)); }

  // Call every frame with elapsed real milliseconds.
  update(dtMs) {
    if (this.paused) return;
    this._acc += dtMs;
    while (this._acc >= this.msPerTick) {
      this._acc -= this.msPerTick;
      this.tick();
    }
  }

  tick() {
    this.minutes += TICK_MINUTES;
    this._emit('tick', this);
    if (this.minutes >= DAY_END) this.sleep({ passedOut: true });
  }

  // Spend energy on an action. Returns false if too tired.
  useEnergy(amount) {
    if (this.energy < amount) return false;
    this.energy -= amount;
    this._emit('energy', this);
    return true;
  }

  // End the day: run overnight hooks, advance the calendar, refill energy.
  sleep({ passedOut = false } = {}) {
    this._emit('overnight', this);
    this.day++;
    if (this.day > DAYS_PER_SEASON) {
      this.day = 1;
      this.season++;
      if (this.season >= SEASONS.length) { this.season = 0; this.year++; }
      this._emit('season', this);
    }
    this.minutes = DAY_START;
    this._acc = 0;
    this.energy = passedOut ? Math.floor(this.max / 2) : this.max;
    this._emit('newDay', { clock: this, passedOut });
  }

  get seasonName() { return SEASONS[this.season]; }

  get timeString() {
    const m = this.minutes % (24 * 60);
    const h = Math.floor(m / 60), min = m % 60;
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  // 0 at 6 AM, 1 at 2 AM; handy for tinting the screen as night falls.
  get dayProgress() { return (this.minutes - DAY_START) / (DAY_END - DAY_START); }
}
