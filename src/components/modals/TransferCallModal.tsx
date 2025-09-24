'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Search, ChevronLeft, ChevronRight, Phone, User, Info } from 'lucide-react';
import { ActiveCall } from '@/hooks/useActiveCallsOptimized';
import { agentsService, Agent } from '@/services/agentsService';
import toast from 'react-hot-toast';

interface Extension {
  id: string;
  extension: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
}

interface TransferCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  call: ActiveCall;
  onTransferComplete: () => void;
}

export function TransferCallModal({ isOpen, onClose, call, onTransferComplete }: TransferCallModalProps) {
  // Transfer service base URL and API key
  const TRANSFER_BASE = process.env.NEXT_PUBLIC_TRANSFER_URL || 'http://localhost:3209';
  const TRANSFER_API_KEY = process.env.NEXT_PUBLIC_API_KEY_TRANSFER || '191e8a1e-d313-4e12-b608-d1a759b1a106';
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [filteredExtensions, setFilteredExtensions] = useState<Extension[]>([]);
  const [selectedExtension, setSelectedExtension] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [context, setContext] = useState<string>(''); // backend defaults to 'from-internal' when empty
  const [mounted, setMounted] = useState(false);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAvailableExtensions();
    }
  }, [isOpen]);

  // Setup portal container
  useEffect(() => {
    setMounted(true);
    let el = document.getElementById('app-modal-root') as HTMLElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-modal-root';
      document.body.appendChild(el);
    }
    setPortalEl(el);
    return () => {
      // do not remove el to allow reuse across modals
    };
  }, []);

  // Keyboard shortcuts: Esc to close, Enter to transfer
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isTransferring) onClose();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedExtension && !isTransferring) handleTransfer();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, selectedExtension, isTransferring]);

  const loadAvailableExtensions = async () => {
    try {
      setIsLoading(true);
      
      // Usar agentsService existente
      const agents = await agentsService.getAgents();
      
      // Converter para formato Extension - INCLUIR TODOS (online e offline)
      const availableExtensions: Extension[] = agents
        .filter((agent: Agent) => 
          agent.ramal !== call.extension // Não incluir ramal da chamada atual
        )
        .map((agent: Agent) => ({
          id: agent.id,
          extension: agent.ramal,
          name: agent.name,
          status: agent.status as 'online' | 'offline' | 'busy'
        }));
      
      setExtensions(availableExtensions);
      setFilteredExtensions(availableExtensions);
    } catch (error) {
      console.error('Erro ao carregar ramais:', error);
      setExtensions([]);
      setFilteredExtensions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar extensões baseado na busca
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredExtensions(extensions);
    } else {
      const filtered = extensions.filter(ext => 
        ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ext.extension.includes(searchQuery)
      );
      setFilteredExtensions(filtered);
    }
    setCurrentPage(1); // Reset para primeira página ao buscar
  }, [searchQuery, extensions]);

  // Calcular paginação
  const totalPages = Math.ceil(filteredExtensions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentExtensions = filteredExtensions.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handleTransfer = async () => {
    if (!selectedExtension || isTransferring) return;

    // Validar se não está transferindo para o mesmo ramal
    if (call.extension === selectedExtension) {
      toast.error('Não é possível transferir para o mesmo ramal');
      return;
    }

    setIsTransferring(true);

    try {
      const response = await fetch(`${TRANSFER_BASE}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TRANSFER_API_KEY,
        },
        body: JSON.stringify({
          ramalOrigem: call.extension,
          ramalDestino: selectedExtension,
          contexto: context || 'default' // Padrão: default
        }),
      });

      const data = await response.json();

      if (response.ok && data.sucesso) {
        toast.success(`Chamada transferida para ramal ${selectedExtension}`);
        onTransferComplete?.();
        onClose();
      } else {
        console.error('Erro na transferência:', data);
        toast.error(data.mensagem || 'Erro ao transferir chamada');
      }
    } catch (error) {
      console.error('Erro na transferência:', error);
      toast.error('Erro de conexão ao transferir chamada');
    } finally {
      setIsTransferring(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#10b981';
      case 'offline': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      default: return 'Desconhecido';
    }
  };

  if (!isOpen || !mounted || !portalEl) return null;

  const modalNode = (
    <div style={{
      position: 'fixed',
      inset: '0',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: '0',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)'
        }}
        onClick={() => !isTransferring && onClose()}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '420px',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          backgroundColor: 'white',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Phone style={{ width: '18px', height: '18px', color: 'white' }} />
              </div>
              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1e293b',
                  margin: '0 0 2px 0'
                }}>Transferir Chamada</h3>
                <p style={{
                  fontSize: '13px',
                  color: '#64748b',
                  margin: '0'
                }}>Ramal {call.extension} → Selecione destino</p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#f8fafc',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>

          {/* Search Field */}
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s',
                backgroundColor: '#fafbfc'
              }}
              placeholder="Buscar por nome ou ramal..."
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.backgroundColor = 'white';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.backgroundColor = '#fafbfc';
              }}
            />
          </div>

          {/* Extensions List */}
          {isLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 0',
              color: '#64748b'
            }}>
              <Loader2 style={{ width: '18px', height: '18px', marginRight: '8px' }} className="animate-spin" />
              Carregando...
            </div>
          ) : filteredExtensions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '24px 0',
              color: '#64748b'
            }}>
              <User style={{ width: '24px', height: '24px', margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ fontSize: '14px', margin: '0' }}>Nenhum agente encontrado</p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginBottom: '16px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {currentExtensions.map((ext) => {
                const isSelected = selectedExtension === ext.extension;
                const statusColor = getStatusColor(ext.status);
                
                return (
                  <button
                    key={ext.id}
                    onClick={() => setSelectedExtension(ext.extension)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? '#667eea' : '#e2e8f0'}`,
                      backgroundColor: isSelected ? '#f0f4ff' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textAlign: 'left'
                    }}
                    onMouseOver={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.backgroundColor = '#fafbfc';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: statusColor
                        }} />
                        <div>
                          <div style={{
                            fontWeight: '500',
                            fontSize: '14px',
                            color: isSelected ? '#4338ca' : '#1e293b'
                          }}>
                            {ext.name}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#64748b'
                          }}>
                            {ext.extension}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '500',
                        color: ext.status === 'online' ? '#059669' : '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {getStatusText(ext.status)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isTransferring}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#64748b',
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: isTransferring ? 'not-allowed' : 'pointer',
                opacity: isTransferring ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (!isTransferring) e.currentTarget.style.backgroundColor = '#f8fafc';
              }}
              onMouseOut={(e) => {
                if (!isTransferring) e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={!selectedExtension || isTransferring}
              style={{
                flex: 1,
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                color: 'white',
                backgroundColor: (!selectedExtension || isTransferring) ? '#94a3b8' : '#667eea',
                border: 'none',
                borderRadius: '6px',
                cursor: (!selectedExtension || isTransferring) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (selectedExtension && !isTransferring) {
                  e.currentTarget.style.backgroundColor = '#5a67d8';
                }
              }}
              onMouseOut={(e) => {
                if (selectedExtension && !isTransferring) {
                  e.currentTarget.style.backgroundColor = '#667eea';
                }
              }}
            >
              {isTransferring && <Loader2 style={{ width: '14px', height: '14px' }} className="animate-spin" />}
              {isTransferring ? 'Transferindo...' : 'Transferir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, portalEl);
}
