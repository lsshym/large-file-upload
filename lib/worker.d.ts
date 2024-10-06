declare module 'omt:*' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}