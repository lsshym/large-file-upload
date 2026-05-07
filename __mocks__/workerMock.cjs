function getState() {
  if (!globalThis.__workerMockState) {
    globalThis.__workerMockState = {
      instances: [],
      chunkMessages: [],
      fileMessages: [],
      terminatedCount: 0,
    };
  }

  return globalThis.__workerMockState;
}

function getConfig() {
  return globalThis.__workerMockConfig || {};
}

function getAction(kind, index) {
  const config = getConfig();
  const actions = config[kind] || {};
  return actions[index] || {};
}

function getDelay(kind, index, fallback) {
  const action = getAction(kind, index);
  if (typeof action.delay === 'number') return action.delay;

  const config = getConfig();
  const delays = config[`${kind}Delays`] || {};
  if (typeof delays[index] === 'number') return delays[index];

  return fallback;
}

class WorkerMock {
  constructor() {
    this.terminated = false;
    getState().instances.push(this);
  }

  postMessage(message, transfer) {
    if (message.port) {
      message.port.onmessage = event => {
        const task = event.data.data;
        getState().chunkMessages.push({ worker: this, message: event.data });
        const action = getAction('chunks', task.index);
        const delay = getDelay('chunks', task.index, task.index === 2 ? 0 : 20);

        setTimeout(() => {
          if (action.throwBeforeMessage) {
            throw new Error(action.throwBeforeMessage);
          }

          message.port.postMessage({
            label: action.label || 'DONE',
            data: action.data || `hash-${task.index}`,
            index: task.index,
          });
        }, delay);
      };
      return;
    }

    getState().fileMessages.push({ worker: this, message, transfer });
    const action = getAction('file', message.index);
    const delay = getDelay('file', message.index, 0);

    setTimeout(() => {
      if (action.onerror) {
        this.onerror?.(action.onerror);
        return;
      }

      this.onmessage?.({
        data: {
          label: action.label || 'DONE',
          data: action.data || `hash-${message.index}`,
          index: message.index,
        },
      });
    }, delay);
  }

  terminate() {
    if (!this.terminated) {
      this.terminated = true;
      getState().terminatedCount++;
    }
  }
}

module.exports = WorkerMock;
module.exports.default = WorkerMock;
