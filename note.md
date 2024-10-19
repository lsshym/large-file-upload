感觉file的blob切片无法保存进indexdDb,暂时不知道原因，后续准备换一个indexdDb的库再尝试

目前采用indexdDb存index的方案，不建议将切片数据存入浏览器，非常耗内存


worker发送数据，携带数据越小，发送越快, 如果数据可以移交，携带大数据时同时发送大量worker会影响性能, 甚至会卡死主线程
如果数据可以共享内存，性能会非常快

在主线程中发起大量请求，会导致浏览器掉帧，尝试将请求移动到webworker中执行

在worker中是可以发起请求的，但是限制很多，最大的问题是函数不可传递，闭包变量丢失
<!-- https://juejin.cn/post/7368288987641774120#heading-2 -->

https://www.bilibili.com/video/BV1Br2dY5EaN/?spm_id_from=333.1007.tianma.1-2-2.click&vd_source=da20ed9cf3bfa781fb389c1fa5563ac4

