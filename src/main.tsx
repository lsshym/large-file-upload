import { render } from 'preact';
import { WorkerPerformance } from './workerPerformance/WorkerPerformance';
import { UploadTest } from './uploadTest/UploadTest';
import { HashCollision } from './HashCollision';
import MainThreadPerformance from './MainThreadPerformance';

const App = () => {
  return (
    <div>
      <div>
        <UploadTest></UploadTest>
      </div>
      <div>
        <HashCollision></HashCollision>
      </div>
      <div>
        <WorkerPerformance></WorkerPerformance>
      </div>
      <MainThreadPerformance></MainThreadPerformance>
    </div>
  );
};
// document.addEventListener('DOMContentLoaded', () => {
//   createMainThreadPerformance();
// });

render(<App />, document.body);
