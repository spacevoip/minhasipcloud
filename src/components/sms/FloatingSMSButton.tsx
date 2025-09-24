'use client';

import React, { useState } from 'react';
import { MessageSquare, X, Send, Phone, AlertCircle, CheckCircle2, ChevronDown, FileText } from 'lucide-react';

interface FloatingSMSButtonProps {
  agentId?: string;
  userId?: string;
}

export function FloatingSMSButton({ agentId, userId }: FloatingSMSButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [destination, setDestination] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'validating'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  const maxLength = 160;

  // Função para controlar abertura externa
  const openSMSWithNumber = React.useCallback((phoneNumber: string) => {
    console.log('📱 Abrindo SMS com número:', phoneNumber);
    setDestination(phoneNumber);
    setIsOpen(true);
  }, []);

  // Expor função globalmente para uso do CallStatusOverlay
  React.useEffect(() => {
    (window as any).openSMSPanel = openSMSWithNumber;
    return () => {
      delete (window as any).openSMSPanel;
    };
  }, [openSMSWithNumber]);
  const remainingChars = maxLength - content.length;

  // Modelos de SMS
  const smsTemplates = {
    'gravacao': [
      'Aviso: esta chamada pode ser gravada para qualidade e seguranca. Prot. ######.',
      'Informacao: o atendimento podera ser gravado. Se nao concordar, avise o agente. Prot. ######.'
    ],
    'inicio': [
      'Atendimento iniciado. Prot. ######. Um agente dara sequencia ao seu caso.',
      'Registramos sua demanda. Prot. ######. Em instantes entraremos em contato.'
    ],
    'contato': [
      'Contato oficial. Nunca solicitamos senha ou codigos por telefone/SMS. Em duvida, encerre e retorne pelos canais habituais.',
      'Mensagem verificada. Nao informe senhas, cartoes ou codigos de verificacao a ninguem.'
    ],
    'finalizacao': [
      'Atendimento concluido. Prot. ######. Se precisar, responda este SMS para reabrir.',
      'Seu atendimento foi finalizado com sucesso. Prot. ######. Obrigado pelo contato.'
    ],
    'avaliacao': [
      'Como foi seu atendimento? Responda com 0 a 10 (0 pessimo, 10 excelente). Prot. ######.'
    ]
  };

  // Gerar protocolo automático no formato anomesdia+5numerosaleatorios
  const generateProtocol = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // últimos 2 dígitos do ano
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const randomNumbers = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `${year}${month}${day}${randomNumbers}`;
  };

  // Substituir protocolo automático
  const replaceProtocol = (text: string) => {
    return text.replace(/######/g, generateProtocol());
  };

  const formatPhonePreview = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) {
      // Formato: 11999999999 -> +55 (11) 99999-9999
      return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    } else if (digits.length === 10) {
      // Formato: 1199999999 -> +55 (11) 9999-9999
      return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    }
    return phone;
  };

  const validatePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10;
  };

  const validateContent = async (messageContent: string) => {
    if (!messageContent.trim()) return { valid: false, message: 'Mensagem não pode estar vazia' };
    
    try {
      setIsValidating(true);
      setStatus('validating');
      setStatusMessage('Verificando mensagem...');
      
      const token = localStorage.getItem('agent_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sms-send/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ content: messageContent.trim() })
      });

      const result = await response.json();
      
      if (result.success && result.valid) {
        return { valid: true };
      } else if (result.success && !result.valid) {
        return { 
          valid: false, 
          message: `Não é possível enviar conteúdo contendo a palavra/frase: "${result.blockedPhrase}". Ajuste e tente novamente` 
        };
      } else {
        return { valid: false, message: result.error || 'Erro ao validar mensagem' };
      }
    } catch (error) {
      return { valid: false, message: 'Erro de conexão ao validar mensagem' };
    } finally {
      setIsValidating(false);
    }
  };

  const handleSend = async () => {
    if (!validatePhone(destination)) {
      setStatus('error');
      setStatusMessage('Número de telefone inválido');
      return;
    }

    // Validar conteúdo contra text_block
    const validation = await validateContent(content);
    if (!validation.valid) {
      setStatus('error');
      setStatusMessage(validation.message);
      return;
    }

    setIsLoading(true);
    setStatus('idle');

    try {
      const token = localStorage.getItem('agent_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sms-send/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          userid: userId || 'default-user',
          agent_id: agentId,
          content: content.trim(),
          destination: destination
        })
      });

      const result = await response.json();

      if (result.success) {
        setStatus('success');
        setStatusMessage('SMS enviado com sucesso!');
        setContent('');
        setDestination('');
        setTimeout(() => {
          setStatus('idle');
          setStatusMessage('');
        }, 3000);
      } else {
        setStatus('error');
        setStatusMessage(result.error || 'Erro ao enviar SMS');
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage('Erro de conexão');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setStatus('idle');
    setStatusMessage('');
    setShowTemplates(false);
  };

  const handleTemplateSelect = (template: string) => {
    const processedTemplate = replaceProtocol(template);
    setContent(processedTemplate);
    setShowTemplates(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          backgroundColor: '#2563eb',
          color: 'white',
          borderRadius: '50%',
          border: 'none',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#1d4ed8';
          e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#2563eb';
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
        }}
        title="Enviar SMS"
      >
        <MessageSquare size={24} />
      </button>

      {/* SMS Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '24px',
          width: '380px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e5e7eb',
          zIndex: 9998,
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
            color: 'white',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={20} />
              <h3 style={{ fontWeight: '600', margin: 0, fontSize: '16px' }}>Enviar SMS</h3>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.8)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'}
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '20px' }}>
            {/* Destination Field */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                <Phone size={14} style={{ marginRight: '6px' }} />
                Destino
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="(11) 99999-9999"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {destination && (
                <p style={{
                  fontSize: '12px',
                  marginTop: '4px',
                  color: validatePhone(destination) ? '#059669' : '#dc2626'
                }}>
                  {validatePhone(destination) ? (
                    <span>✓ {formatPhonePreview(destination)}</span>
                  ) : (
                    <span>✗ Número inválido</span>
                  )}
                </p>
              )}
            </div>

            {/* Content Field */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px'
              }}>
                <label style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Mensagem
                </label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowTemplates(!showTemplates)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      color: '#2563eb',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dbeafe';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                    }}
                  >
                    <FileText size={12} />
                    Modelos
                    <ChevronDown size={12} style={{
                      transform: showTemplates ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }} />
                  </button>
                  
                  {/* Templates Dropdown */}
                  {showTemplates && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: '0',
                      marginTop: '4px',
                      width: '280px',
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      zIndex: 10000,
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      {/* Gravação */}
                      <div style={{ padding: '8px 0' }}>
                        <div style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#374151',
                          backgroundColor: '#f9fafb',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          Aviso de gravação
                        </div>
                        {smsTemplates.gravacao.map((template, index) => (
                          <button
                            key={`gravacao-${index}`}
                            onClick={() => handleTemplateSelect(template)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '11px',
                              color: '#4b5563',
                              backgroundColor: 'transparent',
                              border: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              lineHeight: '1.4',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {template.length > 60 ? `${template.substring(0, 60)}...` : template}
                          </button>
                        ))}
                      </div>
                      
                      {/* Início de atendimento */}
                      <div style={{ padding: '8px 0' }}>
                        <div style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#374151',
                          backgroundColor: '#f9fafb',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          Início de atendimento
                        </div>
                        {smsTemplates.inicio.map((template, index) => (
                          <button
                            key={`inicio-${index}`}
                            onClick={() => handleTemplateSelect(template)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '11px',
                              color: '#4b5563',
                              backgroundColor: 'transparent',
                              border: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              lineHeight: '1.4',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {template.length > 60 ? `${template.substring(0, 60)}...` : template}
                          </button>
                        ))}
                      </div>
                      
                      {/* Contato oficial */}
                      <div style={{ padding: '8px 0' }}>
                        <div style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#374151',
                          backgroundColor: '#f9fafb',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          Contato oficial
                        </div>
                        {smsTemplates.contato.map((template, index) => (
                          <button
                            key={`contato-${index}`}
                            onClick={() => handleTemplateSelect(template)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '11px',
                              color: '#4b5563',
                              backgroundColor: 'transparent',
                              border: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              lineHeight: '1.4',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {template.length > 60 ? `${template.substring(0, 60)}...` : template}
                          </button>
                        ))}
                      </div>
                      
                      {/* Finalização */}
                      <div style={{ padding: '8px 0' }}>
                        <div style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#374151',
                          backgroundColor: '#f9fafb',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          Finalização de atendimento
                        </div>
                        {smsTemplates.finalizacao.map((template, index) => (
                          <button
                            key={`finalizacao-${index}`}
                            onClick={() => handleTemplateSelect(template)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '11px',
                              color: '#4b5563',
                              backgroundColor: 'transparent',
                              border: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              lineHeight: '1.4',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {template.length > 60 ? `${template.substring(0, 60)}...` : template}
                          </button>
                        ))}
                      </div>
                      
                      {/* Avaliação */}
                      <div style={{ padding: '8px 0' }}>
                        <div style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#374151',
                          backgroundColor: '#f9fafb',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          Pedido de avaliação
                        </div>
                        {smsTemplates.avaliacao.map((template, index) => (
                          <button
                            key={`avaliacao-${index}`}
                            onClick={() => handleTemplateSelect(template)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '11px',
                              color: '#4b5563',
                              backgroundColor: 'transparent',
                              border: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              lineHeight: '1.4',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {template.length > 60 ? `${template.substring(0, 60)}...` : template}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Digite sua mensagem..."
                rows={3}
                maxLength={maxLength}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '6px'
              }}>
                <p style={{
                  fontSize: '12px',
                  color: remainingChars >= 0 ? '#6b7280' : '#dc2626',
                  margin: 0
                }}>
                  {remainingChars >= 0 ? `${remainingChars} caracteres restantes` : `${Math.abs(remainingChars)} caracteres excedidos`}
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#9ca3af',
                  margin: 0
                }}>
                  {content.length}/{maxLength}
                </p>
              </div>
            </div>

            {/* Tips */}
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertCircle size={16} style={{ color: '#2563eb', marginTop: '2px', flexShrink: 0 }} />
                <div style={{ fontSize: '12px', color: '#1e40af' }}>
                  <p style={{ fontWeight: '500', margin: '0 0 6px 0' }}>Dicas:</p>
                  <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', color: '#1d4ed8' }}>
                    <li style={{ marginBottom: '4px' }}>• Use números com DDD: (11) 99999-9999</li>
                    <li style={{ marginBottom: '4px' }}>• Máximo 160 caracteres por SMS</li>
                    <li>• Evite caracteres especiais</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Status Message */}
            {status !== 'idle' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '14px',
                marginBottom: '16px',
                backgroundColor: status === 'success' ? '#f0fdf4' : status === 'validating' ? '#eff6ff' : '#fef2f2',
                color: status === 'success' ? '#166534' : status === 'validating' ? '#1e40af' : '#991b1b',
                border: `1px solid ${status === 'success' ? '#bbf7d0' : status === 'validating' ? '#bfdbfe' : '#fecaca'}`
              }}>
                {status === 'success' ? (
                  <CheckCircle2 size={16} style={{ color: '#059669' }} />
                ) : status === 'validating' ? (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #bfdbfe',
                    borderTop: '2px solid #2563eb',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                ) : (
                  <AlertCircle size={16} style={{ color: '#dc2626' }} />
                )}
                {statusMessage}
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={isLoading || isValidating || !validatePhone(destination) || !content.trim() || remainingChars < 0}
              style={{
                width: '100%',
                backgroundColor: (isLoading || isValidating || !validatePhone(destination) || !content.trim() || remainingChars < 0) ? '#d1d5db' : '#2563eb',
                color: 'white',
                padding: '12px 16px',
                borderRadius: '6px',
                fontWeight: '500',
                fontSize: '14px',
                border: 'none',
                cursor: (isLoading || isValidating || !validatePhone(destination) || !content.trim() || remainingChars < 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }
              }}
            >
              {isLoading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Enviando...
                </>
              ) : isValidating ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Verificando...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Enviar SMS
                </>
              )}
            </button>
            
            <style jsx>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            zIndex: 9997
          }}
          onClick={handleClose}
        />
      )}
    </>
  );
}
