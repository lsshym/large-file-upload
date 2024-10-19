self.addEventListener('message', async (event: MessageEvent) => {
  const { time } = event.data;
  //   时间单位
  const value = new Date().getTime() - time;
  console.log(value, value / 1000);
});
