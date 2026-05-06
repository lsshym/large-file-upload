class WorkerMock {
  postMessage(message) {
    if (message.port) {
      message.port.onmessage = event => {
        const task = event.data.data;
        const delay = task.index === 2 ? 0 : 20;

        setTimeout(() => {
          message.port.postMessage({
            label: 'DONE',
            data: `hash-${task.index}`,
            index: task.index,
          });
        }, delay);
      };
      return;
    }

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
