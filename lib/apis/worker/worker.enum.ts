export enum WorkerLabelsEnum {
  INIT = 'INIT',
  INIT_DONE = 'INIT_DONE',
  DOING = 'DOING',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

export type WorkerMessage = {
  label: WorkerLabelsEnum;
  data: ArrayBuffer[] | string;
};
