export enum WorkerLabelsEnum {
  INIT,
  CHUNK,
  DONE,
}

export type WorkerMessage = {
  label: WorkerLabelsEnum;
  data: ArrayBuffer[] | string;
};
