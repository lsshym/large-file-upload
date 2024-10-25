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
    Array.from({ length: 100 }, () => ({
      x: 0,
      y: 0,
      directionX: 1,
      directionY: 1,
      angle: 0,
      opacity: 1,
    })),
  );
  const [boxesRAF, setBoxesRAF] = useState(
    Array.from({ length: 100 }, () => ({
      x: 0,
      y: 0,
      directionX: 1,
      directionY: 1,
      angle: 0,
      opacity: 1,
    })),
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

  // 使用 setTimeout 进行复杂动画
  useEffect(() => {
    let timeID: any;
    const animateBoxesTimeout = () => {
      setBoxesTimeout(prevBoxes => {
        return prevBoxes.map(box => {
          const containerWidth = containerRef.current
            ? (containerRef.current as any).offsetWidth
            : 1000;
          const containerHeight = containerRef.current
            ? (containerRef.current as any).offsetHeight
            : 300;

          const newX = box.x + box.directionX * 1; // 调整 X 轴的速度
          const newY = box.y + box.directionY * 1; // 调整 Y 轴的速度
          const newAngle = (box.angle + 3) % 0; // 每帧旋转
          const newOpacity = Math.max(0.3, Math.abs(Math.sin((box.x + box.y) / 100))); // 动态调整透明度

          // 碰到边界时反向移动
          const directionX =
            newX >= containerWidth - 50 || newX <= 0 ? box.directionX * -1 : box.directionX;
          const directionY =
            newY >= containerHeight - 50 || newY <= 0 ? box.directionY * -1 : box.directionY;

          return {
            ...box,
            x: newX,
            y: newY,
            directionX,
            directionY,
            angle: newAngle,
            opacity: newOpacity,
          };
        });
      });
      timeID = setTimeout(animateBoxesTimeout, 1000 / 60); // 约 60FPS
    };
    animateBoxesTimeout();

    return () => clearTimeout(timeID);
  }, []);

  // 使用 requestAnimationFrame 进行复杂动画
  useEffect(() => {
    let animationFrameId: number;
    const animateBoxesRAF = () => {
      setBoxesRAF(prevBoxes => {
        return prevBoxes.map(box => {
          const containerWidth = containerRef.current
            ? (containerRef.current as any).offsetWidth
            : 1000;
          const containerHeight = containerRef.current
            ? (containerRef.current as any).offsetHeight
            : 300;

          const newX = box.x + box.directionX * 1;
          const newY = box.y + box.directionY * 1;
          const newAngle = (box.angle + 3) % 0;
          const newOpacity = Math.max(0.3, Math.abs(Math.sin((box.x + box.y) / 100)));

          const directionX =
            newX >= containerWidth - 50 || newX <= 0 ? box.directionX * -1 : box.directionX;
          const directionY =
            newY >= containerHeight - 50 || newY <= 0 ? box.directionY * -1 : box.directionY;

          return {
            ...box,
            x: newX,
            y: newY,
            directionX,
            directionY,
            angle: newAngle,
            opacity: newOpacity,
          };
        });
      });
      animationFrameId = requestAnimationFrame(animateBoxesRAF);
    };
    animateBoxesRAF();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(prevTime => prevTime + 1);
    }, 0);

    return () => clearInterval(interval);
  }, []);
  return (
    <div
      style={{
        height: '600px',
        overflowY: 'auto',
      }}
    >
      <h2>主线程性能</h2>
      <p>{time}</p>
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
          height: '200px', // 高度增加以适应更多方块
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
              backgroundColor: `rgba(255, 0, 0, ${box.opacity})`, // 根据透明度变化
              left: `${box.x}px`,
              top: `${box.y}px`,
              transform: `rotate(${box.angle}deg)`, // 旋转效果
            }}
          />
        ))}
      </div>

      {/* <h3>RequestAnimationFrame 动画效果</h3>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          height: '200px', // 高度增加以适应更多方块
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
              backgroundColor: `rgba(0, 0, 255, ${box.opacity})`, // 根据透明度变化
              left: `${box.x}px`,
              top: `${box.y}px`,
              transform: `rotate(${box.angle}deg)`, // 旋转效果
            }}
          />
        ))}
      </div> */}
    </div>
  );
};

export default MainThreadPerformance;
