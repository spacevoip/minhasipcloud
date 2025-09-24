'use client';

interface RecentCall {
  number: string;
  status: string;
  duration: number;
  timestamp: Date;
}

interface RecentCallsListProps {
  recentCalls: RecentCall[];
  onCallSelect: (number: string) => void;
  onClose: () => void;
}

export function RecentCallsList({ recentCalls, onCallSelect, onClose }: RecentCallsListProps) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        <h4 style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#1e293b',
          margin: 0
        }}>
          Chamadas Recentes
        </h4>
        <button
          onClick={onClose}
          style={{
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
          onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
        >
          ← Voltar
        </button>
      </div>
      
      <div style={{
        maxHeight: '280px',
        overflowY: 'auto'
      }}>
        {recentCalls.map((call, index) => (
          <div
            key={index}
            onClick={() => {
              onCallSelect(call.number);
              onClose();
            }}
            style={{
              padding: '12px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: '#fafafa'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.background = '#fafafa'}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px'
            }}>
              <span style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1e293b'
              }}>
                {call.number}
              </span>
              <span style={{
                fontSize: '12px',
                color: call.status === 'Conectado' ? '#10b981' : 
                      call.status === 'Falhou' ? '#ef4444' : '#64748b',
                fontWeight: '500'
              }}>
                {call.status}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#64748b'
            }}>
              <span>
                {call.timestamp.toLocaleTimeString('pt-BR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
              {call.duration > 0 && (
                <span>
                  {Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
