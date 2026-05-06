class WorkerMock {
  postMessage(message) {
    setTimeout(() => {
      this.onmessage?.({
        data: {
          label: 'DONE',
          data: `hash-${message.index}`,
          index: message.index,
        },
      });
    }, 0);
  }

  terminate() {}
}

module.exports = WorkerMock;
module.exports.default = WorkerMock;
