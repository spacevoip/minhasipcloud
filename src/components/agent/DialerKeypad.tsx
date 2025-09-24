'use client';

interface DialerKeypadProps {
  dialNumber: string;
  onNumberChange: (number: string) => void;
  disabled?: boolean;
}

export function DialerKeypad({ dialNumber, onNumberChange, disabled = false }: DialerKeypadProps) {
  const handleDigitClick = (digit: string) => {
    if (disabled) return;
    
    if (digit === '⌫') {
      onNumberChange(dialNumber.slice(0, -1));
    } else if (digit === '🗑') {
      onNumberChange('');
    } else {
      onNumberChange(dialNumber + digit);
    }
  };

  return (
    <>
      {/* Number Display */}
      <div style={{
        background: '#f8fafc',
        border: '2px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        textAlign: 'center',
        filter: disabled ? 'blur(2px)' : 'none'
      }}>
        <input
          type="text"
          value={dialNumber}
          onChange={(e) => onNumberChange(e.target.value)}
          placeholder="Digite o número"
          disabled={disabled}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            fontWeight: '600',
            color: '#1e293b',
            textAlign: 'center',
            width: '100%',
            outline: 'none'
          }}
        />
      </div>

      {/* Keypad */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        marginBottom: '16px',
        filter: disabled ? 'blur(2px)' : 'none'
      }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '🗑'].map((digit) => (
          <button
            key={digit}
            onClick={() => handleDigitClick(digit)}
            disabled={disabled}
            style={{
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '18px',
              fontWeight: '600',
              color: '#374151',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => !disabled && (e.currentTarget.style.background = '#e2e8f0')}
            onMouseOut={(e) => !disabled && (e.currentTarget.style.background = '#f1f5f9')}
          >
            {digit}
          </button>
        ))}
      </div>
    </>
  );
}
