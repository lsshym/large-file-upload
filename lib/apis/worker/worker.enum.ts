import { IHasher } from "hash-wasm/dist/lib/WASMInterface";

export enum WorkerLabelsEnum {
  INIT = 'INIT',
  INIT_DONE = 'INIT_DONE',
  DOING = 'DOING',
  DONE = 'DONE',
  ERROR = 'ERROR',
  TEST = 'TEST',
}

export type WorkerMessage = {
  label: WorkerLabelsEnum;
  data: ArrayBuffer[] | string;
  md5?: IHasher;

};
