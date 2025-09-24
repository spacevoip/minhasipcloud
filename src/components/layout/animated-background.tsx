'use client';

import { useEffect, useRef } from 'react';

interface AnimatedBackgroundProps {
  children: React.ReactNode;
}

export function AnimatedBackground({ children }: AnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const drawWaves = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Sound wave animation
      const waves = [
        { amplitude: 30, frequency: 0.02, speed: 0.02, offset: 0, color: 'rgba(102, 126, 234, 0.1)' },
        { amplitude: 20, frequency: 0.03, speed: 0.025, offset: Math.PI / 3, color: 'rgba(118, 75, 162, 0.08)' },
        { amplitude: 25, frequency: 0.025, speed: 0.018, offset: Math.PI / 2, color: 'rgba(59, 130, 246, 0.06)' }
      ];

      waves.forEach(wave => {
        ctx.beginPath();
        ctx.strokeStyle = wave.color;
        ctx.lineWidth = 2;
        
        for (let x = 0; x <= canvas.width; x += 2) {
          const y = canvas.height / 2 + 
                   Math.sin(x * wave.frequency + time * wave.speed + wave.offset) * wave.amplitude +
                   Math.sin(x * wave.frequency * 2 + time * wave.speed * 1.5) * (wave.amplitude * 0.3);
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      time += 1;
      animationId = requestAnimationFrame(drawWaves);
    };

    resize();
    drawWaves();

    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Animated Background */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
        background: 'transparent',
        overflow: 'hidden'
      }}>
        {/* Mesh gradient layer */}
        <div style={{
          position: 'absolute',
          inset: '-10%',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          opacity: 0.4
        }}>
          <div style={{
            position: 'absolute',
            width: '520px',
            height: '520px',
            left: '-6%',
            top: '10%',
            background: 'radial-gradient(circle at 30% 30%, rgba(14,165,233,.35), rgba(14,165,233,0))',
            borderRadius: '50%',
            filter: 'blur(60px)',
            animation: 'drift 26s ease-in-out infinite'
          }} />
          <div style={{
            position: 'absolute',
            width: '600px',
            height: '600px',
            right: '-8%',
            top: '18%',
            background: 'radial-gradient(circle at 70% 70%, rgba(29,78,216,.35), rgba(29,78,216,0))',
            borderRadius: '50%',
            filter: 'blur(60px)',
            animation: 'drift 32s ease-in-out infinite reverse'
          }} />
        </div>

        {/* Floating blobs */}
        <div style={{
          position: 'absolute',
          width: '460px',
          height: '460px',
          background: 'radial-gradient(circle at 30% 30%, rgba(56, 189, 248, .25), rgba(56, 189, 248, 0))',
          top: '-120px',
          left: '-80px',
          borderRadius: '50%',
          filter: 'blur(60px)',
          opacity: 0.3,
          animation: 'blob 22s ease-in-out infinite'
        }} />
        
        <div style={{
          position: 'absolute',
          width: '420px',
          height: '420px',
          background: 'radial-gradient(circle at 70% 70%, rgba(45, 212, 191, .2), rgba(45, 212, 191, 0))',
          bottom: '-140px',
          left: '10%',
          borderRadius: '50%',
          filter: 'blur(60px)',
          opacity: 0.3,
          animation: 'blob 28s ease-in-out infinite reverse'
        }} />

        <div style={{
          position: 'absolute',
          width: '380px',
          height: '380px',
          background: 'radial-gradient(circle at 50% 50%, rgba(129, 140, 248, .25), rgba(129, 140, 248, 0))',
          top: '20%',
          right: '-120px',
          borderRadius: '50%',
          filter: 'blur(60px)',
          opacity: 0.3,
          animation: 'blob 26s ease-in-out infinite'
        }} />

        {/* Sound wave canvas */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            opacity: 0.6
          }}
        />

        {/* Subtle grain texture */}
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.03,
          mixBlendMode: 'overlay',
          backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23n)" opacity="0.6"/></svg>')`,
          backgroundSize: '300px 300px'
        }} />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>

      <style jsx global>{`
        @keyframes drift {
          0%, 100% { transform: translate3d(0,0,0) }
          50% { transform: translate3d(0,-18px,0) }
        }
        
        @keyframes blob {
          0%, 100% { transform: translate3d(0,0,0) scale(1) }
          50% { transform: translate3d(0,-20px,0) scale(1.05) }
        }
      `}</style>
    </div>
  );
}
