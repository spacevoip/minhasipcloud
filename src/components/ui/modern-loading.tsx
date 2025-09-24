'use client';

import React from 'react';

interface ModernLoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'premium';
}

export const ModernLoading: React.FC<ModernLoadingProps> = ({ 
  message = 'Carregando...', 
  size = 'md',
  variant = 'default' 
}) => {
  // Estilos CSS inline para animações
  const animations = `
    @keyframes modernSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    @keyframes modernPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.7; }
    }
    
    @keyframes modernBounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-8px); }
    }
    
    @keyframes modernShimmer {
      0% { left: -100%; }
      100% { left: 100%; }
    }
    
    @keyframes modernFade {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
  `;

  // Injetar CSS se ainda não foi injetado
  React.useEffect(() => {
    const styleId = 'modern-loading-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = animations;
      document.head.appendChild(style);
    }
  }, []);

  const sizeConfig = {
    sm: { container: '2rem', spinner: '1.5rem', text: '0.875rem' },
    md: { container: '3rem', spinner: '2.5rem', text: '1rem' },
    lg: { container: '4rem', spinner: '3.5rem', text: '1.125rem' }
  };

  const config = sizeConfig[size];

  if (variant === 'minimal') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '1rem'
      }}>
        <div style={{
          width: config.spinner,
          height: config.spinner,
          border: '2px solid rgba(59, 130, 246, 0.2)',
          borderTop: '2px solid #3b82f6',
          borderRadius: '50%',
          animation: 'modernSpin 1s linear infinite'
        }}></div>
        <span style={{
          color: '#64748b',
          fontSize: config.text,
          fontWeight: '500'
        }}>{message}</span>
      </div>
    );
  }

  if (variant === 'premium') {
    return (
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '1rem',
        padding: '2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        minWidth: '300px'
      }}>
        {/* Shimmer background */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent)',
          animation: 'modernShimmer 2s infinite'
        }}></div>

        {/* Multi-circle spinner */}
        <div style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem'
        }}>
          {/* Outer circle */}
          <div style={{
            width: config.container,
            height: config.container,
            border: '2px solid rgba(59, 130, 246, 0.2)',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'modernSpin 1.5s linear infinite',
            position: 'absolute'
          }}></div>
          
          {/* Middle circle */}
          <div style={{
            width: `calc(${config.container} * 0.7)`,
            height: `calc(${config.container} * 0.7)`,
            border: '2px solid rgba(16, 185, 129, 0.2)',
            borderTop: '2px solid #10b981',
            borderRadius: '50%',
            animation: 'modernSpin 1s linear infinite reverse',
            position: 'absolute'
          }}></div>
          
          {/* Inner circle */}
          <div style={{
            width: `calc(${config.container} * 0.3)`,
            height: `calc(${config.container} * 0.3)`,
            backgroundColor: '#f59e0b',
            borderRadius: '50%',
            animation: 'modernPulse 2s ease-in-out infinite'
          }}></div>
        </div>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h3 style={{
            color: '#1e293b',
            fontSize: config.text,
            fontWeight: '600',
            marginBottom: '0.5rem',
            animation: 'modernFade 2s ease-in-out infinite'
          }}>🔄 {message}</h3>
          
          {/* Animated dots */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.25rem',
            marginTop: '1rem'
          }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '0.5rem',
                height: '0.5rem',
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'][i],
                borderRadius: '50%',
                animation: `modernBounce 1.4s ease-in-out infinite ${i * 0.16}s`
              }}></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      gap: '1rem'
    }}>
      <div style={{
        width: config.spinner,
        height: config.spinner,
        border: '3px solid rgba(59, 130, 246, 0.2)',
        borderTop: '3px solid #3b82f6',
        borderRadius: '50%',
        animation: 'modernSpin 1s linear infinite'
      }}></div>
      <p style={{
        color: '#64748b',
        fontSize: config.text,
        fontWeight: '500',
        margin: 0
      }}>{message}</p>
    </div>
  );
};

export default ModernLoading;
