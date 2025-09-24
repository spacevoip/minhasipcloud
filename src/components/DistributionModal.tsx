import React, { useState, useMemo } from 'react';
import { Users, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  ramal: string;
}

interface DistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  agents: Agent[];
  totalContacts: number;
  distributionMode: 'single' | 'multiple';
  setDistributionMode: (mode: 'single' | 'multiple') => void;
  agentDistribution: 'automatic' | 'manual';
  setAgentDistribution: (mode: 'automatic' | 'manual') => void;
  selectedAgent: string | null;
  setSelectedAgent: (id: string | null) => void;
  selectedAgents: {[key: string]: { selected: boolean; quantity?: number }};
  setSelectedAgents: React.Dispatch<React.SetStateAction<{[key: string]: { selected: boolean; quantity?: number }}>>;
}

export default function DistributionModal({
  isOpen,
  onClose,
  onConfirm,
  agents,
  totalContacts,
  distributionMode,
  setDistributionMode,
  agentDistribution,
  setAgentDistribution,
  selectedAgent,
  setSelectedAgent,
  selectedAgents,
  setSelectedAgents
}: DistributionModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  // Paginação
  const totalPages = Math.ceil(agents.length / itemsPerPage);
  const paginatedAgents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return agents.slice(startIndex, startIndex + itemsPerPage);
  }, [agents, currentPage, itemsPerPage]);
  
  // Reset página quando mudar o modo
  React.useEffect(() => {
    setCurrentPage(1);
  }, [distributionMode]);
  
  if (!isOpen) return null;

  const limit = distributionMode === 'single' ? 3000 : 10000;
  const exceeded = totalContacts > limit;
  const effectiveContacts = exceeded ? limit : totalContacts;
  
  // Calcular distribuição de contatos para múltiplos agentes
  const selectedAgentsList = Object.entries(selectedAgents).filter(([_, data]) => data.selected);
  const selectedAgentsCount = selectedAgentsList.length;
  
  // Função para calcular quantos contatos cada agente receberá
  const calculateDistribution = () => {
    if (distributionMode === 'single' || selectedAgentsCount === 0) return {};
    
    const distribution: {[key: string]: number} = {};
    
    if (agentDistribution === 'automatic') {
      // Distribuição automática - dividir igualmente
      const contactsPerAgent = Math.floor(effectiveContacts / selectedAgentsCount);
      const remainder = effectiveContacts % selectedAgentsCount;
      
      selectedAgentsList.forEach(([agentId], index) => {
        distribution[agentId] = contactsPerAgent + (index < remainder ? 1 : 0);
      });
    } else {
      // Distribuição manual - usar quantidades especificadas
      let totalManual = 0;
      selectedAgentsList.forEach(([agentId, data]) => {
        const quantity = data.quantity || 0;
        distribution[agentId] = Math.min(quantity, effectiveContacts);
        totalManual += distribution[agentId];
      });
      
      // Se o total manual exceder os contatos disponíveis, ajustar proporcionalmente
      if (totalManual > effectiveContacts) {
        const ratio = effectiveContacts / totalManual;
        selectedAgentsList.forEach(([agentId]) => {
          distribution[agentId] = Math.floor(distribution[agentId] * ratio);
        });
      }
    }
    
    return distribution;
  };
  
  const contactsDistribution = calculateDistribution();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: 'white',
        padding: '1.25rem',
        borderRadius: '10px',
        maxWidth: '380px',
        width: '90%',
        maxHeight: '75vh',
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e2e8f0',
        position: 'relative',
        animation: 'slideUp 0.3s ease-out'
      }}>
        {/* Header com botão de fechar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem'
        }}>
          <h3 style={{
            fontSize: '0.95rem',
            fontWeight: '600',
            color: '#374151',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Users size={14} color="#64748b" />
            Distribuir Contatos
          </h3>
          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              background: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#e2e8f0';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#f8fafc';
            }}
          >
            <X size={14} color="#64748b" />
          </button>
        </div>
        
        <div style={{
          background: '#f8fafc',
          padding: '6px 10px',
          borderRadius: '5px',
          marginBottom: '1rem',
          border: '1px solid #e2e8f0'
        }}>
          <p style={{
            color: '#64748b',
            fontSize: '0.75rem',
            margin: 0,
            fontWeight: '500'
          }}>
            {totalContacts.toLocaleString()} contatos processados
          </p>
        </div>

        {/* Modo de Distribuição */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{
            fontSize: '0.7rem',
            fontWeight: '600',
            color: '#64748b',
            margin: '0 0 6px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Modo
          </h4>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px'
          }}>
            <button
              onClick={() => setDistributionMode('single')}
              style={{
                padding: '10px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: distributionMode === 'single' ? '#f0f9ff' : 'white',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                fontWeight: '600',
                color: distributionMode === 'single' ? '#1e40af' : '#374151',
                fontSize: '0.8rem'
              }}>
                Agente Único
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: distributionMode === 'single' ? '#3b82f6' : '#64748b',
                marginTop: '1px'
              }}>
                Até 3K contatos
              </div>
            </button>
            
            <button
              onClick={() => setDistributionMode('multiple')}
              style={{
                padding: '10px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: distributionMode === 'multiple' ? '#f0f9ff' : 'white',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                fontWeight: '600',
                color: distributionMode === 'multiple' ? '#1e40af' : '#374151',
                fontSize: '0.8rem'
              }}>
                Múltiplos Agentes
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: distributionMode === 'multiple' ? '#3b82f6' : '#64748b',
                marginTop: '1px'
              }}>
                Até 10K distribuído
              </div>
            </button>
          </div>
        </div>

        {/* Aviso de Limite */}
        {exceeded && (
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 50%, #ffffff 100%)',
            border: '1px solid #0ea5e9',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Efeito fumaça de fundo */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(ellipse at top left, rgba(56, 189, 248, 0.1) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(14, 165, 233, 0.08) 0%, transparent 50%)',
              pointerEvents: 'none'
            }} />
            <AlertTriangle size={16} color="#0284c7" style={{ marginTop: '2px', flexShrink: 0, zIndex: 1 }} />
            <div style={{ zIndex: 1 }}>
              <div style={{
                color: '#0c4a6e',
                fontWeight: '600',
                fontSize: '0.875rem',
                marginBottom: '4px'
              }}>
                Limite excedido
              </div>
              <p style={{
                color: '#0369a1',
                margin: 0,
                fontSize: '0.8rem',
                lineHeight: '1.4'
              }}>
                Processaremos apenas {limit.toLocaleString()} dos {totalContacts.toLocaleString()} contatos.
              </p>
            </div>
          </div>
        )}

        {/* Validação de múltiplos agentes */}
        {distributionMode === 'multiple' && selectedAgentsCount > 0 && selectedAgentsCount < 2 && (
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fef9e7 50%, #ffffff 100%)',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertTriangle size={16} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{
                color: '#92400e',
                fontWeight: '600',
                fontSize: '0.875rem',
                marginBottom: '4px'
              }}>
                Seleção insuficiente
              </div>
              <p style={{
                color: '#a16207',
                margin: 0,
                fontSize: '0.8rem',
                lineHeight: '1.4'
              }}>
                Para modo múltiplo, selecione pelo menos 2 agentes.
              </p>
            </div>
          </div>
        )}

        {/* Seleção de Agentes */}
        {distributionMode === 'single' ? (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <h4 style={{
                fontSize: '0.8rem',
                fontWeight: '600',
                color: '#374151',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Agente
              </h4>
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.7rem',
                  color: '#64748b'
                }}>
                  <span>{currentPage}/{totalPages}</span>
                </div>
              )}
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              maxHeight: '160px',
              overflowY: 'auto'
            }}>
              {paginatedAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    background: selectedAgent === agent.id ? '#f0f9ff' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: '600',
                      color: selectedAgent === agent.id ? '#1e40af' : '#1e293b',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {agent.name}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: selectedAgent === agent.id ? '#3b82f6' : '#64748b',
                      marginTop: '1px'
                    }}>
                      #{agent.ramal}
                    </div>
                  </div>
                  {selectedAgent === agent.id && (
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: '#6366f1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <div style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: 'white'
                      }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
            
            {/* Controles de Paginação para Agente Único */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '8px'
              }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    width: '28px',
                    height: '28px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    background: currentPage === 1 ? '#f8fafc' : 'white',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <ChevronLeft size={14} color={currentPage === 1 ? '#d1d5db' : '#64748b'} />
                </button>
                
                <span style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  minWidth: '40px',
                  textAlign: 'center'
                }}>
                  {currentPage} / {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    width: '28px',
                    height: '28px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    background: currentPage === totalPages ? '#f8fafc' : 'white',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <ChevronRight size={14} color={currentPage === totalPages ? '#d1d5db' : '#64748b'} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <h4 style={{
                fontSize: '0.8rem',
                fontWeight: '600',
                color: '#374151',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Distribuição
              </h4>
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.7rem',
                  color: '#64748b'
                }}>
                  <span>{currentPage}/{totalPages}</span>
                </div>
              )}
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              marginBottom: '12px'
            }}>
              <button
                onClick={() => setAgentDistribution('automatic')}
                style={{
                  padding: '8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: agentDistribution === 'automatic' ? '#f0f9ff' : 'white',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  fontWeight: '600',
                  color: agentDistribution === 'automatic' ? '#1e40af' : '#374151',
                  fontSize: '0.75rem'
                }}>
                  Automático
                </div>
                <div style={{
                  fontSize: '0.65rem',
                  color: agentDistribution === 'automatic' ? '#3b82f6' : '#64748b',
                  marginTop: '1px'
                }}>
                  Igual
                </div>
              </button>
              
              <button
                onClick={() => setAgentDistribution('manual')}
                style={{
                  padding: '8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: agentDistribution === 'manual' ? '#f0f9ff' : 'white',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  fontWeight: '600',
                  color: agentDistribution === 'manual' ? '#1e40af' : '#374151',
                  fontSize: '0.75rem'
                }}>
                  Manual
                </div>
                <div style={{
                  fontSize: '0.65rem',
                  color: agentDistribution === 'manual' ? '#3b82f6' : '#64748b',
                  marginTop: '1px'
                }}>
                  Específica
                </div>
              </button>
            </div>

            {/* Lista de Agentes */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              maxHeight: '160px',
              overflowY: 'auto'
            }}>
              {paginatedAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgents((prev: {[key: string]: { selected: boolean; quantity?: number }}) => ({
                      ...prev,
                      [agent.id]: {
                        selected: !prev[agent.id]?.selected,
                        quantity: prev[agent.id]?.quantity
                      }
                    }));
                  }}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    background: selectedAgents[agent.id]?.selected ? '#f0f9ff' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: '600',
                      color: selectedAgents[agent.id]?.selected ? '#1e40af' : '#1e293b',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {agent.name}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: selectedAgents[agent.id]?.selected ? '#3b82f6' : '#64748b',
                      marginTop: '1px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span>#{agent.ramal}</span>
                      {selectedAgents[agent.id]?.selected && contactsDistribution[agent.id] && (
                        <span style={{
                          padding: '1px 4px',
                          background: '#dbeafe',
                          color: '#1e40af',
                          borderRadius: '3px',
                          fontSize: '0.65rem',
                          fontWeight: '600'
                        }}>
                          {contactsDistribution[agent.id].toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {selectedAgents[agent.id]?.selected && (
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: '#6366f1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <div style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: 'white'
                      }} />
                    </div>
                  )}
                  
                  {agentDistribution === 'manual' && selectedAgents[agent.id]?.selected && (
                    <input
                      type="number"
                      placeholder="Qtd"
                      min="1"
                      max="10000"
                      value={selectedAgents[agent.id]?.quantity || ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedAgents((prev: {[key: string]: { selected: boolean; quantity?: number }}) => ({
                          ...prev,
                          [agent.id]: {
                            selected: prev[agent.id]?.selected || false,
                            quantity: value ? parseInt(value) : undefined
                          }
                        }));
                      }}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        width: '50px',
                        textAlign: 'center',
                        fontSize: '0.75rem',
                        flexShrink: 0
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
            
            {/* Controles de Paginação para Múltiplos Agentes */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '8px'
              }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    width: '28px',
                    height: '28px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    background: currentPage === 1 ? '#f8fafc' : 'white',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <ChevronLeft size={14} color={currentPage === 1 ? '#d1d5db' : '#64748b'} />
                </button>
                
                <span style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  minWidth: '40px',
                  textAlign: 'center'
                }}>
                  {currentPage} / {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    width: '28px',
                    height: '28px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    background: currentPage === totalPages ? '#f8fafc' : 'white',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <ChevronRight size={14} color={currentPage === totalPages ? '#d1d5db' : '#64748b'} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Botões */}
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
          paddingTop: '6px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: '#f8fafc',
              color: '#64748b',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.8rem',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#e2e8f0';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#f8fafc';
            }}
          >
            Cancelar
          </button>
          
          <button
            onClick={onConfirm}
            disabled={
              distributionMode === 'single' ? !selectedAgent : 
              selectedAgentsCount < 2
            }
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: (distributionMode === 'single' ? !selectedAgent : 
                selectedAgentsCount < 2) 
                ? '#d1d5db' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: 'white',
              cursor: (distributionMode === 'single' ? !selectedAgent : 
                selectedAgentsCount < 2) 
                ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '0.8rem',
              transition: 'all 0.2s'
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
