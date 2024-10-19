/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'preact/hooks';

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

  const [boxesTimeout, setBoxesTimeout] = useState(
    Array.from({ length: 20 }, () => ({ x: 0, direction: 1 })),
  );
  const [boxesRAF, setBoxesRAF] = useState(
    Array.from({ length: 20 }, () => ({ x: 0, direction: 1 })),
  );

  const containerRef = useRef(null);

  useEffect(() => {
    // 定时获取性能数据
    const interval = setInterval(() => {
      const loadTime = performance.now(); // 自页面加载以来的毫秒数

      // 获取内存使用情况
      const memoryUsage = (performance as any).memory || {
        jsHeapSizeLimit: 0,
        totalJSHeapSize: 0,
        usedJSHeapSize: 0,
      };

      // 计算 FPS
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

      setPerformanceData(prev => ({
        ...prev,
        loadTime,
        memoryUsage,
        fps: prev.fps, // FPS 由 requestAnimationFrame 计算
      }));
    }, 1000);

    // 清除定时器
    return () => clearInterval(interval);
  }, []);

  // 使用 setTimeout 进行动画
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let timeID: any;
    const animateBoxesTimeout = () => {
      setBoxesTimeout(prevBoxes => {
        return prevBoxes.map(box => {
          const containerWidth = containerRef.current
            ? (containerRef.current as any).offsetWidth
            : 1000;
          const newX = box.x + box.direction * 5; // 固定速度
          if (newX >= containerWidth - 50 || newX <= 0) {
            return { ...box, direction: box.direction * -1 }; // 碰到边界反向移动
          }
          return { ...box, x: newX };
        });
      });
      timeID = setTimeout(animateBoxesTimeout, 1000 / 60); // 约 60FPS
    };
    animateBoxesTimeout();

    return () => clearTimeout(timeID);
  }, []);

  // 使用 requestAnimationFrame 进行动画
  useEffect(() => {
    let animationFrameId: number;
    const animateBoxesRAF = () => {
      setBoxesRAF(prevBoxes => {
        return prevBoxes.map(box => {
          const containerWidth = containerRef.current
            ? (containerRef.current as any).offsetWidth
            : 1000;
          const newX = box.x + box.direction * 5; // 固定移动速度
          if (newX >= containerWidth - 50 || newX <= 0) {
            return { ...box, direction: box.direction * -1 }; // 碰到边界反向移动
          }
          return { ...box, x: newX };
        });
      });
      animationFrameId = requestAnimationFrame(animateBoxesRAF);
    };
    animateBoxesRAF();

    return () => cancelAnimationFrame(animationFrameId);
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

      <h3>SetTimeout 动画效果</h3>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          height: '150px',
          width: '100%',
          border: '1px solid #ccc',
          overflow: 'hidden',
          marginBottom: '20px',
        }}
      >
        {boxesTimeout.map((box, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              width: '50px',
              height: '50px',
              backgroundColor: '#ff0000',
              left: `${box.x}px`,
              top: `${(index % 10) * 30}px`,
            }}
          />
        ))}
      </div>

      <h3>RequestAnimationFrame 动画效果</h3>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          height: '150px',
          width: '100%',
          border: '1px solid #ccc',
          overflow: 'hidden',
        }}
      >
        {boxesRAF.map((box, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              width: '50px',
              height: '50px',
              backgroundColor: '#0000ff',
              left: `${box.x}px`,
              top: `${(index % 10) * 30}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
export default MainThreadPerformance;
