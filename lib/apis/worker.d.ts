// declare module 'worker-loader!*' {
//     const WorkerFactory: new () => Worker;
//     export default WorkerFactory;
//   }
declare module '*?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
