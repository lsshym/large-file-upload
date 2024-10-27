/* eslint-disable @typescript-eslint/no-explicit-any */

import testCon from './testCon.ts?worker';
export const WorkerConcurrentTest = () => {
  const fileInputChange = async () => {
    for (let i = 0; i < 4; i++) {
      const tes = new testCon();
      tes.postMessage({});
    }
  };

  return (
    <div>
      worker并发能性能测试
      <div>
        <button onClick={fileInputChange} >dianwo</button>
      </div>
    </div>
  );
};
