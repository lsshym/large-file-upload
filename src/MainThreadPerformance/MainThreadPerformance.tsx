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
    averageFPS: 0,
    minFPS: Infinity,
    maxFPS: 0,
    averageMemoryUsage: {
      jsHeapSizeLimit: 0,
      totalJSHeapSize: 0,
      usedJSHeapSize: 0,
    },
    minMemoryUsage: {
      jsHeapSizeLimit: Infinity,
      totalJSHeapSize: Infinity,
      usedJSHeapSize: Infinity,
    },
    maxMemoryUsage: {
      jsHeapSizeLimit: 0,
      totalJSHeapSize: 0,
      usedJSHeapSize: 0,
    },
    paintTiming: 0,
    navigationTiming: 0,
  });

  const [randomNumber, setRandomNumber] = useState(Math.random());

  const fpsValues = useRef<number[]>([]);
  const memoryUsageValues = useRef<any[]>([]);

  const containerRef = useRef(null);
  const animationTimeoutRef = useRef<any>(null);

  // 初始化方块，随机位置
  const createInitialBoxes = () => {
    const containerWidth = containerRef.current
      ? (containerRef.current as any).offsetWidth
      : 1000;
    const containerHeight = containerRef.current
      ? (containerRef.current as any).offsetHeight
      : 300;

    return Array.from({ length: 150 }, () => ({
      x: Math.random() * (containerWidth - 60), // 减去方块宽度
      y: Math.random() * (containerHeight - 60),
      directionX: Math.random() > 0.5 ? 1 : -1,
      directionY: Math.random() > 0.5 ? 1 : -1,
      angle: 0,
      opacity: 1,
    }));
  };

  const [boxesTimeout, setBoxesTimeout] = useState(createInitialBoxes());

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

      // 保存内存使用数据用于计算平均值和最小值、最大值
      memoryUsageValues.current.push(memoryUsage);

      setPerformanceData(prev => ({
        ...prev,
        loadTime,
        memoryUsage,
        minMemoryUsage: {
          jsHeapSizeLimit: Math.min(
            prev.minMemoryUsage.jsHeapSizeLimit,
            memoryUsage.jsHeapSizeLimit,
          ),
          totalJSHeapSize: Math.min(
            prev.minMemoryUsage.totalJSHeapSize,
            memoryUsage.totalJSHeapSize,
          ),
          usedJSHeapSize: Math.min(
            prev.minMemoryUsage.usedJSHeapSize,
            memoryUsage.usedJSHeapSize,
          ),
        },
        maxMemoryUsage: {
          jsHeapSizeLimit: Math.max(
            prev.maxMemoryUsage.jsHeapSizeLimit,
            memoryUsage.jsHeapSizeLimit,
          ),
          totalJSHeapSize: Math.max(
            prev.maxMemoryUsage.totalJSHeapSize,
            memoryUsage.totalJSHeapSize,
          ),
          usedJSHeapSize: Math.max(
            prev.maxMemoryUsage.usedJSHeapSize,
            memoryUsage.usedJSHeapSize,
          ),
        },
      }));
    }, 1000);

    // 清除定时器
    return () => clearInterval(interval);
  }, []);

  // FPS 计算
  useEffect(() => {
    let frame = 0;
    let lastTime = performance.now();

    const calcFPS = () => {
      const now = performance.now();
      frame++;
      if (now > lastTime + 1000) {
        const fps = Math.round((frame * 1000) / (now - lastTime));
        fpsValues.current.push(fps); // 保存FPS值用于计算平均值

        setPerformanceData(prev => ({
          ...prev,
          fps,
          averageFPS:
            fpsValues.current.reduce((a, b) => a + b, 0) / fpsValues.current.length,
          minFPS: Math.min(prev.minFPS, fps),
          maxFPS: Math.max(prev.maxFPS, fps),
        }));
        frame = 0;
        lastTime = now;
      }
      requestAnimationFrame(calcFPS);
    };
    calcFPS();

    return () => {
      fpsValues.current = [];
    };
  }, []);

  // 使用 setTimeout 进行复杂动画
  useEffect(() => {
    const animateBoxesTimeout = () => {
      setBoxesTimeout(prevBoxes => {
        return prevBoxes.map(box => {
          const containerWidth = containerRef.current
            ? (containerRef.current as any).offsetWidth
            : 1000;
          const containerHeight = containerRef.current
            ? (containerRef.current as any).offsetHeight
            : 300;

          const newX = box.x + box.directionX * 2; // 调整 X 轴的速度
          const newY = box.y + box.directionY * 2; // 调整 Y 轴的速度
          const newAngle = (box.angle + 3) % 360; // 每帧旋转
          const newOpacity = Math.max(0.3, Math.abs(Math.sin((box.x + box.y) / 100))); // 动态调整透明度

          // 碰到边界时反向移动
          const directionX =
            newX >= containerWidth - 60 || newX <= 0 ? box.directionX * -1 : box.directionX;
          const directionY =
            newY >= containerHeight - 60 || newY <= 0 ? box.directionY * -1 : box.directionY;

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
      animationTimeoutRef.current = setTimeout(animateBoxesTimeout, 1000 / 60); // 约 60FPS
    };
    animateBoxesTimeout();

    return () => clearTimeout(animationTimeoutRef.current);
  }, []);

  // 计算内存使用的平均值
  useEffect(() => {
    if (memoryUsageValues.current.length > 0) {
      const avgMemoryUsage = memoryUsageValues.current.reduce(
        (acc, curr) => {
          return {
            jsHeapSizeLimit: acc.jsHeapSizeLimit + curr.jsHeapSizeLimit,
            totalJSHeapSize: acc.totalJSHeapSize + curr.totalJSHeapSize,
            usedJSHeapSize: acc.usedJSHeapSize + curr.usedJSHeapSize,
          };
        },
        {
          jsHeapSizeLimit: 0,
          totalJSHeapSize: 0,
          usedJSHeapSize: 0,
        },
      );

      const length = memoryUsageValues.current.length;

      setPerformanceData(prev => ({
        ...prev,
        averageMemoryUsage: {
          jsHeapSizeLimit: avgMemoryUsage.jsHeapSizeLimit / length,
          totalJSHeapSize: avgMemoryUsage.totalJSHeapSize / length,
          usedJSHeapSize: avgMemoryUsage.usedJSHeapSize / length,
        },
      }));
    }
  }, [performanceData.memoryUsage]);

  // 快速刷新随机数
  useEffect(() => {
    const interval = setInterval(() => {
      setRandomNumber(Math.random());
    }, 0); // 每100毫秒更新一次

    return () => clearInterval(interval);
  }, []);

  const handleResetParameters = () => {
    fpsValues.current = [];
    memoryUsageValues.current = [];
    setPerformanceData({
      loadTime: 0,
      memoryUsage: {
        jsHeapSizeLimit: 0,
        totalJSHeapSize: 0,
        usedJSHeapSize: 0,
      },
      fps: 0,
      averageFPS: 0,
      minFPS: Infinity,
      maxFPS: 0,
      averageMemoryUsage: {
        jsHeapSizeLimit: 0,
        totalJSHeapSize: 0,
        usedJSHeapSize: 0,
      },
      minMemoryUsage: {
        jsHeapSizeLimit: Infinity,
        totalJSHeapSize: Infinity,
        usedJSHeapSize: Infinity,
      },
      maxMemoryUsage: {
        jsHeapSizeLimit: 0,
        totalJSHeapSize: 0,
        usedJSHeapSize: 0,
      },
      paintTiming: 0,
      navigationTiming: 0,
    });
    // 重置方块位置
    setBoxesTimeout(createInitialBoxes());
  };

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h2 style={{ textAlign: 'center' }}>主线程性能监控</h2>

      <button onClick={handleResetParameters} style={{ marginBottom: '20px' }}>
        重置性能参数
      </button>

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h3>快速刷新随机数</h3>
        <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{randomNumber.toFixed(6)}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', margin: '10px' }}>
          <h3>FPS 数据</h3>
          <p>当前 FPS: {performanceData.fps}</p>
          <p>
            平均 FPS:{' '}
            {isNaN(performanceData.averageFPS)
              ? 'N/A'
              : performanceData.averageFPS.toFixed(2)}
          </p>
          <p>最低 FPS: {performanceData.minFPS === Infinity ? 'N/A' : performanceData.minFPS}</p>
          <p>最高 FPS: {performanceData.maxFPS}</p>
        </div>

        <div style={{ flex: '1 1 300px', margin: '10px' }}>
          <h3>内存使用情况</h3>
          <p>
            JS 堆大小限制:{' '}
            {(performanceData.memoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
          </p>
          <p>
            已使用的 JS 堆大小:{' '}
            {(performanceData.memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
          </p>
          <p>
            总的 JS 堆大小:{' '}
            {(performanceData.memoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>

        <div style={{ flex: '1 1 300px', margin: '10px' }}>
          <h3>平均内存使用情况</h3>
          <p>
            平均 JS 堆大小限制:{' '}
            {(performanceData.averageMemoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
          </p>
          <p>
            平均已使用的 JS 堆大小:{' '}
            {(performanceData.averageMemoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
          </p>
          <p>
            平均总的 JS 堆大小:{' '}
            {(performanceData.averageMemoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>最小和最大内存使用情况</h3>
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', margin: '10px' }}>
            <h4>最小内存使用</h4>
            <p>
              最小 JS 堆大小限制:{' '}
              {(performanceData.minMemoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
            </p>
            <p>
              最小已使用的 JS 堆大小:{' '}
              {(performanceData.minMemoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
            </p>
            <p>
              最小总的 JS 堆大小:{' '}
              {(performanceData.minMemoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>

          <div style={{ flex: '1 1 300px', margin: '10px' }}>
            <h4>最大内存使用</h4>
            <p>
              最大 JS 堆大小限制:{' '}
              {(performanceData.maxMemoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
            </p>
            <p>
              最大已使用的 JS 堆大小:{' '}
              {(performanceData.maxMemoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
            </p>
            <p>
              最大总的 JS 堆大小:{' '}
              {(performanceData.maxMemoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: '40px' }}>动画效果</h3>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          height: '300px',
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
              width: '60px',
              height: '60px',
              backgroundColor: `rgba(255, 0, 0, ${box.opacity})`,
              left: `${box.x}px`,
              top: `${box.y}px`,
              transform: `rotate(${box.angle}deg)`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default MainThreadPerformance;
