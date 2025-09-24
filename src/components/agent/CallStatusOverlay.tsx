'use client';

import { Phone, PhoneOff, Pause, Mic, MicOff, MessageSquare, Eye, X } from 'lucide-react';

interface CallStatusOverlayProps {
  callStatus: 'calling' | 'ringing' | 'connected';
  callTarget: string;
  callTargetNumber: string;
  callDuration: number;
  isMuted: boolean;
  onHangup: () => void;
  onToggleMute: () => void;
  onPause?: () => void;
  onSMS?: (phoneNumber: string) => void;
  onViewSheet?: () => void;
  sheetData?: Record<string, any> | null;
  onCloseSheet?: () => void;
}

export function CallStatusOverlay({
  callStatus,
  callTarget,
  callTargetNumber,
  callDuration,
  isMuted,
  onHangup,
  onToggleMute,
  onPause,
  onSMS,
  onViewSheet,
  sheetData,
  onCloseSheet
}: CallStatusOverlayProps) {
  const formatCallDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Friendly labels and helpers for the contact sheet
  const friendlyLabels: Record<string, string> = {
    cpf: 'CPF',
    cnpj: 'CNPJ',
    documento: 'Documento',
    email: 'E-mail',
    emails: 'E-mails',
    celular: 'Celular',
    mobile: 'Celular',
    telefone: 'Telefone',
    phone: 'Telefone',
    ddd: 'DDD',
    ddi: 'DDI',
    address: 'Endereço',
    endereco: 'Endereço',
    endereco_rua: 'Rua',
    rua: 'Rua',
    numero: 'Número',
    bairro: 'Bairro',
    cidade: 'Cidade',
    municipio: 'Município',
    estado: 'UF',
    uf: 'UF',
    cep: 'CEP',
    origem: 'Origem',
    origem_campanha: 'Origem Campanha',
    campanha: 'Campanha',
    score: 'Score',
  };

  const toLabel = (key: string) => friendlyLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const toValue = (val: any) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      try { return JSON.stringify(val); } catch { return String(val); }
    }
    return String(val);
  };
  const isEmpty = (val: any) => {
    if (val === null || val === undefined) return true;
    if (typeof val === 'string') return val.trim().length === 0;
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === 'object') return Object.keys(val).length === 0;
    return false;
  };
  const preferredOrder = ['cpf','cnpj','documento','email','emails','celular','mobile','telefone','phone','ddd','ddi','endereco','address','endereco_rua','rua','numero','bairro','cidade','municipio','estado','uf','cep','origem','origem_campanha','campanha','score'];

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#1e293b',
      zIndex: 10,
      padding: '30px 20px',
      overflow: 'hidden'
    }}>
      {/* Animated Wave Background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        opacity: 0.3
      }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 400"
          style={{
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
          <defs>
            <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.1)" />
              <stop offset="50%" stopColor="rgba(147, 197, 253, 0.08)" />
              <stop offset="100%" stopColor="rgba(219, 234, 254, 0.05)" />
            </linearGradient>
          </defs>
          <path
            d="M0,200 Q100,150 200,200 T400,200 L400,400 L0,400 Z"
            fill="url(#waveGradient)"
            style={{
              animation: 'waveMove 4s ease-in-out infinite'
            }}
          />
          <path
            d="M0,220 Q150,170 300,220 T600,220 L600,400 L0,400 Z"
            fill="rgba(59, 130, 246, 0.05)"
            style={{
              animation: 'waveMove 6s ease-in-out infinite reverse'
            }}
          />
        </svg>
      </div>

      {/* Call Status */}
      <div style={{
        fontSize: '14px',
        fontWeight: '500',
        marginBottom: '6px',
        opacity: 0.8,
        color: '#64748b'
      }}>
        {callStatus === 'calling' && 'Ligando...'}
        {callStatus === 'ringing' && 'Chamando...'}
        {callStatus === 'connected' && 'Em chamada'}
      </div>

      {/* Call Timer */}
      <div style={{
        fontSize: '16px',
        fontWeight: '600',
        marginBottom: sheetData ? 12 : 30,
        color: '#475569'
      }}>
        {formatCallDuration(callDuration)}
      </div>

      {/* Contact Avatar (hidden when sheet open) */}
      {!sheetData && (
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          border: '2px solid rgba(59, 130, 246, 0.2)'
        }}>
          <Phone size={24} color="#3b82f6" />
        </div>
      )}

      {/* Contact Name/Number (hidden when sheet open) */}
      {!sheetData && (
        <div style={{
          textAlign: 'center',
          color: '#1e293b',
          marginBottom: '24px'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '4px'
          }}>
            {callTarget}
          </div>
          <div style={{
            fontSize: '14px',
            color: '#64748b',
            fontWeight: '500'
          }}>
            {callTargetNumber}
          </div>
          {onViewSheet && !sheetData && (
            <div style={{ marginTop: '10px' }}>
              <button
                onClick={onViewSheet}
                style={{
                  background: '#e2e8f0',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  borderRadius: '999px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#cbd5e1'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
              >
                Ver Ficha
              </button>
            </div>
          )}
        </div>
      )}

      {/* Call Controls */}
      <div style={{
        display: 'flex',
        gap: '30px',
        alignItems: 'center'
      }}>
        {/* SMS Button - Only show when connected */}
        {callStatus === 'connected' && onSMS && (
          <button
            onClick={() => {
              // Extract phone number without country code (55)
              const cleanNumber = callTargetNumber.replace(/\D/g, '');
              const phoneWithoutCountryCode = cleanNumber.startsWith('55') && cleanNumber.length > 11 
                ? cleanNumber.substring(2) 
                : cleanNumber;
              console.log('🔥 CallStatusOverlay - Número original:', callTargetNumber);
              console.log('🔥 CallStatusOverlay - Número limpo:', cleanNumber);
              console.log('🔥 CallStatusOverlay - Número sem país:', phoneWithoutCountryCode);
              onSMS(phoneWithoutCountryCode);
            }}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.15)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.1)'}
            title="Enviar SMS"
          >
            <MessageSquare size={20} />
          </button>
        )}

        {/* Pause/Hold Button - Always show when sheet is open; otherwise hide only when connected with SMS button */}
        {onPause && (sheetData || (callStatus !== 'connected' || !onSMS)) && (
          <button
            onClick={onPause}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'rgba(100, 116, 139, 0.1)',
              border: '1px solid rgba(100, 116, 139, 0.2)',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(100, 116, 139, 0.15)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(100, 116, 139, 0.1)'}
          >
            <Pause size={20} />
          </button>
        )}

        {/* Hangup Button */}
        <button
          onClick={onHangup}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#ef4444',
            border: 'none',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.background = '#dc2626';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = '#ef4444';
          }}
        >
          <PhoneOff size={24} />
        </button>

        {/* Mute Button */}
        <button
          onClick={onToggleMute}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: isMuted ? '#f59e0b' : 'rgba(100, 116, 139, 0.1)',
            border: '1px solid rgba(100, 116, 139, 0.2)',
            color: isMuted ? 'white' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            if (!isMuted) e.currentTarget.style.background = 'rgba(100, 116, 139, 0.15)';
          }}
          onMouseOut={(e) => {
            if (!isMuted) e.currentTarget.style.background = 'rgba(100, 116, 139, 0.1)';
          }}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* View Sheet Button */}
        {onViewSheet && !sheetData && (
          <button
            onClick={onViewSheet}
            style={{
              height: '44px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#1f2937',
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
            title="Ver Ficha"
          >
            <Eye size={18} />
            Ver Ficha
          </button>
        )}
      </div>

      {/* Inline Contact Sheet inside overlay */}
      {sheetData && (
        <div style={{
          width: '100%',
          maxWidth: '720px',
          marginTop: '16px',
          background: 'linear-gradient(180deg, #ffffff, #f8fafc)',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          boxShadow: '0 6px 14px rgba(2, 6, 23, 0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, letterSpacing: 0.3 }}>Ficha do Contato</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{String(sheetData.name ?? '')}</div>
              <div style={{ fontSize: '12px', color: '#475569' }}>{String(sheetData.number ?? '')}</div>
            </div>
            {onCloseSheet && (
              <button onClick={onCloseSheet} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                <X size={14} /> Voltar
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', padding: '12px', maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
            {Object.entries(sheetData)
              .filter(([k, v]) => !['name','number','id'].includes(String(k)) && !isEmpty(v))
              .map(([k, v]) => (
                <div key={String(k)} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize', marginBottom: 4 }}>{toLabel(String(k))}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-word', whiteSpace: typeof v === 'object' ? 'pre-wrap' as const : 'normal' }}>{toValue(v)}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
