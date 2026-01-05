class Throttle {
  constructor({ limit, intervalMs }) {
    this.limit = limit;
    this.intervalMs = intervalMs;
    this.queue = [];
    this.active = 0;

    setInterval(() => {
      this.active = 0;
      this.process();
    }, intervalMs);
  }

  async run(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    while (this.active < this.limit && this.queue.length) {
      const { fn, resolve, reject } = this.queue.shift();
      this.active++;

      fn().then(resolve).catch(reject);
    }
  }
}

// const throttle = (limit, intervalMs) => new Throttle({ limit, intervalMs });

export { Throttle };
