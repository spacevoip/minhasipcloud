'use client';

import { useState, ReactNode, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
}

export function Tooltip({ 
  content, 
  children, 
  position = 'top', 
  delay = 500,
  disabled = false 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showTooltip = () => {
    if (disabled || !content.trim()) return;
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      // Calculate optimal position based on viewport
      if (triggerRef.current && tooltipRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight
        };

        let newPosition = position;

        // Check if tooltip would overflow and adjust position
        if (position === 'top' && triggerRect.top - tooltipRect.height < 10) {
          newPosition = 'bottom';
        } else if (position === 'bottom' && triggerRect.bottom + tooltipRect.height > viewport.height - 10) {
          newPosition = 'top';
        } else if (position === 'left' && triggerRect.left - tooltipRect.width < 10) {
          newPosition = 'right';
        } else if (position === 'right' && triggerRect.right + tooltipRect.width > viewport.width - 10) {
          newPosition = 'left';
        }

        setActualPosition(newPosition);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const getTooltipStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '0.5rem 0.75rem',
      borderRadius: '0.375rem',
      fontSize: '0.75rem',
      fontWeight: '500',
      zIndex: 10000,
      pointerEvents: 'none' as const,
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'scale(1)' : 'scale(0.95)',
      transition: 'all 0.15s ease-in-out',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      backdropFilter: 'blur(8px)',
      maxWidth: '200px',
      wordWrap: 'break-word' as const,
      whiteSpace: 'normal' as const
    };

    switch (actualPosition) {
      case 'top':
        return {
          ...baseStyle,
          bottom: '100%',
          left: '50%',
          transform: `translateX(-50%) ${isVisible ? 'translateY(-8px) scale(1)' : 'translateY(-4px) scale(0.95)'}`,
          marginBottom: '0.5rem'
        };
      case 'bottom':
        return {
          ...baseStyle,
          top: '100%',
          left: '50%',
          transform: `translateX(-50%) ${isVisible ? 'translateY(8px) scale(1)' : 'translateY(4px) scale(0.95)'}`,
          marginTop: '0.5rem'
        };
      case 'left':
        return {
          ...baseStyle,
          right: '100%',
          top: '50%',
          transform: `translateY(-50%) ${isVisible ? 'translateX(-8px) scale(1)' : 'translateX(-4px) scale(0.95)'}`,
          marginRight: '0.5rem'
        };
      case 'right':
        return {
          ...baseStyle,
          left: '100%',
          top: '50%',
          transform: `translateY(-50%) ${isVisible ? 'translateX(8px) scale(1)' : 'translateX(4px) scale(0.95)'}`,
          marginLeft: '0.5rem'
        };
      default:
        return baseStyle;
    }
  };

  const getArrowStyle = () => {
    const arrowSize = 6;
    const baseArrow = {
      position: 'absolute' as const,
      width: 0,
      height: 0,
      borderStyle: 'solid' as const
    };

    switch (actualPosition) {
      case 'top':
        return {
          ...baseArrow,
          top: '100%',
          left: '50%',
          marginLeft: `-${arrowSize}px`,
          borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
          borderColor: 'rgba(0, 0, 0, 0.9) transparent transparent transparent'
        };
      case 'bottom':
        return {
          ...baseArrow,
          bottom: '100%',
          left: '50%',
          marginLeft: `-${arrowSize}px`,
          borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
          borderColor: 'transparent transparent rgba(0, 0, 0, 0.9) transparent'
        };
      case 'left':
        return {
          ...baseArrow,
          left: '100%',
          top: '50%',
          marginTop: `-${arrowSize}px`,
          borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
          borderColor: 'transparent transparent transparent rgba(0, 0, 0, 0.9)'
        };
      case 'right':
        return {
          ...baseArrow,
          right: '100%',
          top: '50%',
          marginTop: `-${arrowSize}px`,
          borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
          borderColor: 'transparent rgba(0, 0, 0, 0.9) transparent transparent'
        };
      default:
        return baseArrow;
    }
  };

  return (
    <div
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {content.trim() && (
        <div
          ref={tooltipRef}
          style={getTooltipStyle()}
          role="tooltip"
          aria-hidden={!isVisible}
        >
          {content}
          <div style={getArrowStyle()} />
        </div>
      )}
    </div>
  );
}

// Hook para tooltip programático
export function useTooltip() {
  const [isVisible, setIsVisible] = useState(false);
  const [content, setContent] = useState('');
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const showTooltip = (text: string, x: number, y: number) => {
    setContent(text);
    setPosition({ x, y });
    setIsVisible(true);
  };

  const hideTooltip = () => {
    setIsVisible(false);
    setContent('');
  };

  return {
    isVisible,
    content,
    position,
    showTooltip,
    hideTooltip
  };
}
