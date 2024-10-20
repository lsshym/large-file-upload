// assembly/index.ts

// 导出一个处理函数，用于将输入的 Uint8Array 数据处理成 ArrayBuffer
export function processData(pointer: usize, length: i32): void {
    for (let i = 0; i < length; i++) {
      // 逐个字节读取数据，进行简单处理 (取反操作)，然后写回内存
      let value = load<u8>(pointer + i);
      store<u8>(pointer + i, value ^ 0xFF); // 将每个字节取反 (仅为示例)
    }
  }
  