import { render } from 'preact';
import { WorkerPerformance } from './workerPerformance/WorkerPerformance';
import { UploadTest } from './uploadTest/UploadTest';
import { HashCollision } from './HashCollision';
import MainThreadPerformance from './MainThreadPerformance/MainThreadPerformance';
import { UploadWorkerTest } from './uploadWorkerTest/UploadWorkerTest';
import { WorkerConcurrentTest } from './WorkerConcurrentTest/WorkerConcurrentTest';

const App = () => {
  return (
    <div>
      <div>
        <UploadTest></UploadTest>
      </div>
      <div>
        <UploadWorkerTest></UploadWorkerTest>
      </div>
      <div>
        <HashCollision></HashCollision>
      </div>
      <div>
        <WorkerPerformance></WorkerPerformance>
      </div>
      <div>
        <WorkerConcurrentTest></WorkerConcurrentTest>
      </div>
      <MainThreadPerformance></MainThreadPerformance>
    </div>
  );
};

render(<App />, document.body);
