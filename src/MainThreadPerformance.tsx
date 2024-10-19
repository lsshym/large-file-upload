import { useState, useEffect } from 'preact/hooks';

const MainThreadPerformance = () => {
  const [performanceData, setPerformanceData] = useState({
    loadTime: 0,
    memoryUsage: {
      jsHeapSizeLimit: 0,
      totalJSHeapSize: 0,
      usedJSHeapSize: 0,
    },
    fps: 0,
  });

  useEffect(() => {
    // 定时获取性能数据
    const interval = setInterval(() => {
      // 获取页面加载时间
      const loadTime = performance.now(); // 自页面加载以来的毫秒数

      // 获取内存使用情况（只在支持的浏览器中可用）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memoryUsage = (performance as any).memory || {
        jsHeapSizeLimit: 0,
        totalJSHeapSize: 0,
        usedJSHeapSize: 0,
      };

      // 获取 FPS（每秒帧数），通过 requestAnimationFrame 计算
      let lastTime = performance.now();
      let frame = 0;
      const calcFPS = () => {
        const now = performance.now();
        frame++;
        if (now > lastTime + 1000) {
          const fps = Math.round((frame * 1000) / (now - lastTime));
          setPerformanceData(prev => ({
            ...prev,
            fps,
          }));
          frame = 0;
          lastTime = now;
        }
        requestAnimationFrame(calcFPS);
      };
      calcFPS();

      // 更新性能数据
      setPerformanceData({
        loadTime,
        memoryUsage,
        fps: performanceData.fps, // fps 由上面的 requestAnimationFrame 计算
      });
    }, 1000);

    // 清除定时器
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>主线程性能</h2>
      <p>页面加载时间: {performanceData.loadTime.toFixed(2)} 毫秒</p>
      <p>FPS: {performanceData.fps}</p>
      <p>内存使用情况:</p>
      <ul>
        <li>
          JS堆大小限制: {(performanceData.memoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
        </li>
        <li>
          已使用的JS堆大小: {(performanceData.memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)}{' '}
          MB
        </li>
        <li>
          总的JS堆大小: {(performanceData.memoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB
        </li>
      </ul>
    </div>
  );
};

export default MainThreadPerformance;
