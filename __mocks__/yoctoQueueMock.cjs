class YoctoQueue {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  enqueue(value) {
    this.items.push(value);
  }

  dequeue() {
    return this.items.shift();
  }

  clear() {
    this.items = [];
  }
}

module.exports = YoctoQueue;
module.exports.default = YoctoQueue;
