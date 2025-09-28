import React, { memo } from 'react';
import { PhoneCall } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

interface ActivityPoint {
  t: string;
  talking: number;
  ringing: number;
}

interface ActiveCallsSummaryProps {
  activeCalls: number;
  ringingCalls: number;
  history: ActivityPoint[];
  loading?: boolean;
}

const CARD_CONTAINER_STYLE: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.95)',
  borderRadius: '1.25rem',
  padding: '1.5rem',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  backdropFilter: 'blur(20px)',
  position: 'relative',
  overflow: 'hidden'
};

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem'
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#1e293b',
  marginBottom: '0.25rem'
};

const SUBTITLE_STYLE: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#64748b'
};

const METRIC_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '1rem',
  marginBottom: '1.5rem'
};

const METRIC_CARD_BASE: React.CSSProperties = {
  padding: '1rem',
  borderRadius: '0.75rem',
  textAlign: 'center'
};

const SUMMARY_CONTAINER_STYLE: React.CSSProperties = {
  marginTop: '1.5rem',
  padding: '1rem',
  background: 'rgba(248, 250, 252, 0.8)',
  borderRadius: '0.75rem',
  border: '1px solid #e2e8f0'
};

const SUMMARY_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '0.75rem',
  fontSize: '0.75rem'
};

const COLOR_DOT_BASE: React.CSSProperties = {
  width: '0.5rem',
  height: '0.5rem',
  borderRadius: '50%'
};

const ActiveCallsSummary: React.FC<ActiveCallsSummaryProps> = (
  { activeCalls, ringingCalls, history, loading = false }
) => {
  const totalCalls = activeCalls + ringingCalls;

  return (
    <div className="active-calls-summary" style={CARD_CONTAINER_STYLE}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: 'linear-gradient(90deg, #10b981, #059669)',
        borderRadius: '1.25rem 1.25rem 0 0'
      }} />

      <div style={HEADER_STYLE}>
        <div>
          <h3 style={TITLE_STYLE}>Chamadas Ativas</h3>
          <p style={SUBTITLE_STYLE}>Status das chamadas em tempo real</p>
        </div>
        <div style={{
          padding: '0.75rem',
          borderRadius: '0.75rem',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))',
          color: '#10b981'
        }}>
          <PhoneCall style={{ width: '1.25rem', height: '1.25rem' }} />
        </div>
      </div>

      <div style={METRIC_GRID_STYLE}>
        <div style={{
          ...METRIC_CARD_BASE,
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#10b981',
            marginBottom: '0.25rem'
          }}>
            {loading ? '—' : activeCalls}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>Falando</div>
        </div>
        <div style={{
          ...METRIC_CARD_BASE,
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.2)'
        }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#f59e0b',
            marginBottom: '0.25rem'
          }}>
            {loading ? '—' : ringingCalls}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#d97706', fontWeight: 500 }}>Chamando</div>
        </div>
        <div style={{
          ...METRIC_CARD_BASE,
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#3b82f6',
            marginBottom: '0.25rem'
          }}>
            {loading ? '—' : totalCalls}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#1d4ed8', fontWeight: 500 }}>Total</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={history} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradTalking" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradRinging" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey="t" stroke="#94a3b8" fontSize={12} />
          <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Area
            type="monotone"
            dataKey="talking"
            name="Falando"
            stroke="#10b981"
            fill="url(#gradTalking)"
            strokeWidth={2}
            isAnimationActive={!loading}
            animationDuration={700}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="ringing"
            name="Chamando"
            stroke="#f59e0b"
            fill="url(#gradRinging)"
            strokeWidth={2}
            isAnimationActive={!loading}
            animationDuration={700}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div style={SUMMARY_CONTAINER_STYLE}>
        <div style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#1e293b',
          marginBottom: '0.75rem'
        }}>
          Resumo das Chamadas:
        </div>
        <div style={SUMMARY_GRID_STYLE}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ ...COLOR_DOT_BASE, background: '#10b981', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#64748b' }}>Falando:</span>
            <span style={{ fontWeight: 600, color: '#10b981' }}>{loading ? '—' : `${activeCalls} chamadas`}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ ...COLOR_DOT_BASE, background: '#f59e0b', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#64748b' }}>Chamando:</span>
            <span style={{ fontWeight: 600, color: '#f59e0b' }}>{loading ? '—' : `${ringingCalls} chamadas`}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ ...COLOR_DOT_BASE, background: '#3b82f6' }} />
            <span style={{ color: '#64748b' }}>Total:</span>
            <span style={{ fontWeight: 600, color: '#3b82f6' }}>{loading ? '—' : `${totalCalls} chamadas`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ActiveCallsSummary);
