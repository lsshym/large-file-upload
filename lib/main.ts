import {
  currentFileChunks,
  generateFileHashWithCrypto,
  uploadChunksWithPool,
} from "./fileToolbox";
import { PromisePool } from "./PromisePool";

export {
  currentFileChunks,
  generateFileHashWithCrypto,
  uploadChunksWithPool,
  PromisePool,
};

const FileUploadTools = {
  currentFileChunks,
  generateFileHashWithCrypto,
  uploadChunksWithPool,
  PromisePool,
};

export default FileUploadTools;
