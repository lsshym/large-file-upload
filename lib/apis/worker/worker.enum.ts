export enum WorkerLabelsEnum {
  INIT,
  CHUNK,
  DONE,
  ERROR,
}

export type WorkerMessage = {
  label: WorkerLabelsEnum;
  data: ArrayBuffer[] | string;
};
