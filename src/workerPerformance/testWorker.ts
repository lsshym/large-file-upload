/* eslint-disable @typescript-eslint/no-explicit-any */
self.addEventListener('message', async (event: MessageEvent) => {
  const port = event.data.port;

  // 监听 MessagePort 收到的消息
  port.onmessage = async function (event: { data: { time: any; }; }) {
    const { time } = event.data;

    const value = new Date().getTime() - time;
    console.log(value, value / 1000);
  };
});
