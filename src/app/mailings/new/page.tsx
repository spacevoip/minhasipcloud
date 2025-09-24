'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Users, Send, Save, FileCheck, X, User, Phone, Mail, CheckCircle, ArrowLeft } from 'lucide-react';
import { mailingsService } from '@/lib/mailingsService';
import { agentsService, Agent } from '@/services/agentsService';
import { MainLayout } from '@/components/layout/main-layout';
import { analyzeFile, normalizeContactsFromRows, rowsToObjects, CSVAnalysis, ColumnMapping } from '@/lib/csvSmartParser';
import DistributionModal from '@/components/DistributionModal';

interface Contact {
  name?: string;
  phone?: string;
}

// Tipos movidos para csvSmartParser (ColumnMapping, CSVAnalysis)

export default function NewCampaignPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [campaignName, setCampaignName] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  
  // Estados para distribuição inteligente de agentes
  const [distributionMode, setDistributionMode] = useState<'single' | 'multiple'>('single');
  const [agentDistribution, setAgentDistribution] = useState<'automatic' | 'manual'>('automatic');
  const [selectedAgents, setSelectedAgents] = useState<{[key: string]: { selected: boolean; quantity?: number }}>({});
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [distributionConfigured, setDistributionConfigured] = useState(false);
  const [isEditingDistribution, setIsEditingDistribution] = useState(false);
  const [distributionSummary, setDistributionSummary] = useState<{
    mode: 'single' | 'multiple';
    selectedColumns: string[];
    selectedAgents: Array<{id: string; name: string; ramal: string; quantity?: number}>;
    totalContacts: number;
    contactsPerAgent?: number;
  } | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStep, setSaveStep] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fullRecords, setFullRecords] = useState<Record<string, string>[]>([]);
  const [addCountryCode, setAddCountryCode] = useState(false);
  
  // Estados para preview do CSV
  const [csvAnalysis, setCsvAnalysis] = useState<CSVAnalysis | null>(null);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});

  useEffect(() => {
    loadUserAgents();
  }, []);

  const loadUserAgents = async () => {
    try {
      setIsLoadingAgents(true);
      console.log('🔄 Carregando agentes reais do backend...');
      
      const realAgents = await agentsService.getAgents();
      
      // Usar agentes diretamente do agentsService
      setAgents(realAgents);
      console.log('✅ Agentes carregados para mailings:', realAgents.length);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
      setModalMessage('Erro ao carregar agentes');
      setShowErrorModal(true);
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'campaignName') {
      setCampaignName(value);
    } else if (field === 'selectedAgent') {
      setSelectedAgent(value);
    }
  };

  // Parsing robusto com detecção de delimitador/aspas e suporte a Excel via xlsx

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      setIsProcessingFile(true);
      setUploadedFile(file);
      
      // Analisar arquivo e mostrar preview (headers, preview, totalRows, mapeamento sugerido)
      const analysis = await analyzeFile(file);
      setCsvAnalysis(analysis);
      setColumnMapping(analysis.mapping || {});
      setShowColumnMapping(true);
      // Auto-carregar todos os registros e contatos sugeridos sem exigir clique extra
      const autoRecords = rowsToObjects(analysis.headers, analysis.bodyRows);
      const autoContacts = normalizeContactsFromRows(analysis.bodyRows, analysis.mapping || {}, addCountryCode, analysis.headers);
      setFullRecords(autoRecords);
      setContacts(autoContacts);
      
      setModalMessage(`Arquivo analisado: ${analysis.totalRows} linhas e ${analysis.headers.length} colunas detectadas`);
      setShowInfoModal(true);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      setModalMessage(error instanceof Error ? error.message : 'Erro ao processar arquivo');
      setShowErrorModal(true);
      setUploadedFile(null);
      setCsvAnalysis(null);
      setShowColumnMapping(false);
      setFullRecords([]);
      setContacts([]);
    } finally {
      setIsProcessingFile(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Garante que índices do mapeamento estão dentro do range de colunas
  const sanitizeMapping = (mapping: ColumnMapping, headersCount: number): ColumnMapping => {
    const safe: ColumnMapping = {};
    const clamp = (idx?: number) => (typeof idx === 'number' && idx >= 0 && idx < headersCount ? idx : undefined);
    safe.name = clamp(mapping?.name);
    safe.phone = clamp(mapping?.phone);
    // Preservar campos extras
    safe.extra1 = clamp(mapping?.extra1);
    safe.extra2 = clamp(mapping?.extra2);
    safe.extra3 = clamp(mapping?.extra3);
    return safe;
  };

  const processContacts = async () => {
    if (!uploadedFile || !csvAnalysis) {
      setModalMessage('Nenhum arquivo selecionado');
      setShowErrorModal(true);
      return;
    }
    
    try {
      setIsProcessingFile(true);
      // Normalizar contatos a partir das linhas do corpo e do mapeamento escolhido
      const safeMap = sanitizeMapping(columnMapping, csvAnalysis.headers.length);
      const processedContacts = normalizeContactsFromRows(csvAnalysis.bodyRows, safeMap, addCountryCode, csvAnalysis.headers);
      const records = rowsToObjects(csvAnalysis.headers, csvAnalysis.bodyRows);
      setContacts(processedContacts);
      setFullRecords(records);
      setShowColumnMapping(false);
      
      // Abrir modal de distribuição de agentes
      setShowDistributionModal(true);
      setIsProcessingFile(false);
    } catch (error) {
      console.error('Erro ao processar contatos:', error);
      setModalMessage(error instanceof Error ? error.message : 'Erro ao processar contatos');
      setShowErrorModal(true);
      setIsProcessingFile(false);
    }
  };

  // Normalização movida para csvSmartParser.normalizeContactsFromRows

  const handleSave = async (status: 'active' | 'disabled' = 'active') => {
    if (!campaignName.trim()) {
      setModalMessage('Por favor, insira o nome da campanha');
      setShowErrorModal(true);
      return;
    }
    
    if (!distributionConfigured) {
      setModalMessage('Por favor, configure a distribuição de agentes');
      setShowErrorModal(true);
      return;
    }
    
    if (contacts.length === 0 && fullRecords.length === 0) {
      setModalMessage('Por favor, processe o arquivo para carregar os dados');
      setShowErrorModal(true);
      return;
    }

    // Verificar limite de campanhas antes de criar
    try {
      const response = await mailingsService.getMailings();
      if (response.success && response.data.length >= 3) {
        setModalMessage('Limite máximo de 3 campanhas atingido. Exclua uma campanha existente para criar uma nova.');
        setShowErrorModal(true);
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar campanhas existentes:', error);
      // Continuar mesmo com erro na verificação, pois o backend também valida
    }
    
    try {
      setIsSaving(true);
      setSaveProgress(0);
      setSaveStep('Preparando dados...');
      
      // Otimização 1: Processar apenas contatos essenciais
      const optimizedContacts = contacts.slice(0, 10000);
      setSaveProgress(15);
      setSaveStep('Preparando contatos...');
      
      await new Promise(resolve => setTimeout(resolve, 300));
      setSaveProgress(25);
      setSaveStep('Validando informações...');
      
      // Determinar agent_id baseado no modo de distribuição
      const agentId = distributionMode === 'single' ? selectedAgent : null;
      
      // Transformar selectedAgents object em array para múltiplos agentes
      const selectedAgentsArray = distributionMode === 'multiple' 
        ? Object.entries(selectedAgents)
            .filter(([_, agentData]) => agentData.selected)
            .map(([agentId, agentData]) => ({
              id: agentId,
              quantity: agentData.quantity || 0
            }))
        : undefined;
      
      const mailingData = {
        name: campaignName,
        agent_id: agentId,
        total: fullRecords.length || contacts.length,
        content: {
          uploadedFile: uploadedFile?.name,
          headers: csvAnalysis?.headers || [],
          contacts: optimizedContacts,
          mapping: csvAnalysis ? sanitizeMapping(columnMapping, csvAnalysis.headers.length) : columnMapping,
          distributionMode,
          selectedAgents: selectedAgentsArray,
          agentDistribution: distributionMode === 'multiple' ? agentDistribution : undefined
        },
        status
      };
      
      await new Promise(resolve => setTimeout(resolve, 400));
      setSaveProgress(45);
      setSaveStep('Conectando ao servidor...');
      
      await new Promise(resolve => setTimeout(resolve, 200));
      setSaveProgress(60);
      setSaveStep('Enviando campanha...');
      
      console.log('🔍 [DEBUG] Dados otimizados sendo enviados:', {
        ...mailingData,
        content: { ...mailingData.content, contacts: `${mailingData.content.contacts.length} contatos` }
      });
      
      await mailingsService.createMailing(mailingData);
      setSaveProgress(85);

      setSaveStep('Salvando no banco...');
      setSaveProgress(90);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      setSaveStep('Finalizando...');
      setSaveProgress(95);
      
      // Invalidate mailings cache to ensure fresh list after redirect
      try {
        localStorage.removeItem('pabx_mailings_cache');
        localStorage.removeItem('pabx_mailings_cache_timestamp');
      } catch {}

      setSaveProgress(100);
      setSaveStep('Concluído!');
      
      // Delay para mostrar 100%
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setModalMessage('Campanha criada com sucesso!');
      setShowSuccessModal(true);
      
      // Aguardar modal ser fechado para redirecionar
      setTimeout(() => {
        router.push('/mailings?refresh=1');
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao salvar campanha:', error);
      if (error instanceof Error) {
        console.log('🔎 Detalhe do erro:', error.message);
      }
      setSaveStep('Erro ao salvar');
      setSaveProgress(0);
      setModalMessage(error instanceof Error ? error.message : 'Erro ao salvar campanha');
      setShowErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <MainLayout>
      <div className="pageContainer" style={{
        padding: '2rem',
        width: '100%',
        margin: 0,
        minHeight: '100vh'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <button
            onClick={() => router.push('/mailings')}
            style={{
              padding: '12px',
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <ArrowLeft size={20} />
          </button>
          
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: '#1e293b',
              margin: 0,
              marginBottom: '0.5rem'
            }}>
              Nova Campanha
            </h1>
            <p style={{
              color: '#64748b',
              fontSize: '1rem',
              margin: 0
            }}>
              Crie uma nova campanha de email marketing
            </p>
          </div>
        </div>

        <div className="mainGrid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 420px)',
          gap: '1.5rem',
          alignItems: 'start',
          width: '100%'
        }}>
          {/* Formulário Principal */}
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '2rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            border: '1px solid #f1f5f9'
          }}>
            {/* Nome da Campanha */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Nome da Campanha
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ex: Promoção Black Friday 2024"
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  border: '2px solid #f1f5f9',
                  borderRadius: '16px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  background: '#fafbfc',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#6366f1';
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#f1f5f9';
                  e.currentTarget.style.background = '#fafbfc';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Preview e Mapeamento de Colunas */}
            {showColumnMapping && csvAnalysis && (
              <div style={{
                marginBottom: '2rem',
                padding: '24px',
                background: '#f8fafc',
                borderRadius: '16px',
                border: '2px solid #e2e8f0'
              }}>
                <h4 style={{
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <FileText size={18} />
                  Preview do Arquivo | Selecione até 5 Colunas do seu Arquivo
                </h4>

                {/* Mapeamento de Colunas - nome, telefone e 3 extras */}
                <div className="mappingGrid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  marginBottom: '16px',
                  padding: '12px',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}>
                  {[
                    { key: 'name', label: 'Nome', required: true },
                    { key: 'phone', label: 'Telefone', required: true },
                    { key: 'extra1', label: 'Coluna 1', required: false },
                    { key: 'extra2', label: 'Coluna 2', required: false },
                    { key: 'extra3', label: 'Coluna 3', required: false }
                  ].map((field) => (
                    <div key={field.key}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: field.required ? '#dc2626' : '#374151', marginBottom: 6 }}>
                        {field.label} {field.required && '*'}
                      </label>
                      <select
                        value={
                          (columnMapping as any)[field.key] != null
                            ? String((columnMapping as any)[field.key])
                            : ''
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          setColumnMapping((prev) => {
                            const next = { ...prev } as any;
                            if (val === '') delete next[field.key];
                            else next[field.key] = Number(val);
                            return next;
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          background: 'white',
                          fontSize: '12px',
                          color: '#374151'
                        }}
                      >
                        <option value="">Não usar</option>
                        {csvAnalysis.headers.map((h, idx) => (
                          <option key={idx} value={idx}>{`${idx + 1} - ${h}`}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Opção para adicionar código do país */}
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={addCountryCode}
                      onChange={(e) => setAddCountryCode(e.target.checked)}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer'
                      }}
                    />
                    Adicionar código do país (55) aos telefones
                  </label>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b',
                    marginTop: '4px',
                    marginLeft: '24px'
                  }}>
                    Exemplo: 11914648632 → 5511914648632
                  </div>
                </div>

                {/* Tabela de Preview movida para o card da direita (Lista de Contatos) */}

                {/* Informações da Lista */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '16px',
                  marginBottom: '20px',
                  padding: '16px',
                  background: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#3b82f6',
                      marginBottom: '4px'
                    }}>
                      {csvAnalysis.totalRows.toLocaleString()}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: '600'
                    }}>
                      Total de Contatos
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#10b981',
                      marginBottom: '4px'
                    }}>
                      {csvAnalysis.headers.length}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: '600'
                    }}>
                      Colunas Detectadas
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#f59e0b',
                      marginBottom: '4px'
                    }}>
                      {csvAnalysis.preview.length}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: '600'
                    }}>
                      Linhas Preview
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={() => {
                      setShowColumnMapping(false);
                      setCsvAnalysis(null);
                      setUploadedFile(null);
                    }}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: 'white',
                      color: '#64748b',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={processContacts}
                    disabled={isProcessingFile}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      opacity: isProcessingFile ? 0.5 : 1
                    }}
                  >
                    {isProcessingFile ? 'Processando...' : 'Processar Contatos'}
                  </button>
                </div>
              </div>
            )}

            {/* Preview dos contatos processados */}
            {contacts.length > 0 && (
              <div style={{
                marginBottom: '2rem',
                padding: '20px',
                background: '#f0fdf4',
                borderRadius: '16px',
                border: '2px solid #bbf7d0'
              }}>
                <h4 style={{
                  margin: '0 0 12px 0',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle size={16} />
                  {fullRecords.length} registros carregados com sucesso ({csvAnalysis?.headers.length ?? 0} colunas detectadas)
                </h4>
                <p style={{
                  margin: 0,
                  fontSize: '12px',
                  color: '#15803d'
                }}>
                  {uploadedFile?.name} - Colunas Selecionadas: ({Object.entries(columnMapping)
                    .filter(([_, index]) => index !== undefined)
                    .map(([field, index]) => {
                      // Retorna o nome real da coluna do CSV ao invés do label genérico
                      return csvAnalysis?.headers[index as number] || field;
                    })
                    .join(', ')})
                </p>
              </div>
            )}

            {/* Resumo da Distribuição Configurada - Apenas para modo múltiplo */}
            {distributionConfigured && distributionSummary && distributionSummary.mode === 'multiple' && (
              <div style={{
                marginBottom: '2rem',
                padding: '20px',
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                borderRadius: '12px',
                border: '1px solid #0ea5e9',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Efeito sutil de fundo */}
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(14, 165, 233, 0.1)',
                  opacity: 0.6
                }} />
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                  position: 'relative',
                  zIndex: 1
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Users size={14} color="white" />
                  </div>
                  <span style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#0c4a6e'
                  }}>Distribuição Configurada</span>
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    marginLeft: 'auto',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      fontSize: '11px',
                      color: '#0369a1',
                      background: 'rgba(255, 255, 255, 0.8)',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontWeight: '500',
                      border: '1px solid rgba(14, 165, 233, 0.2)'
                    }}>
                      {Math.min(distributionSummary.totalContacts, 10000).toLocaleString()} / 10.000 contatos
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: '#0369a1',
                      background: 'rgba(255, 255, 255, 0.8)',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontWeight: '500',
                      border: '1px solid rgba(14, 165, 233, 0.2)'
                    }}>
                      {distributionSummary.selectedColumns.length} colunas
                    </span>
                    
                    {/* Botões de Edição */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => {
                          // Adicionar novo agente
                          const availableAgents = agents.filter(agent => 
                            !distributionSummary?.selectedAgents.some(selected => selected.id === agent.id)
                          );
                          if (availableAgents.length > 0) {
                            const newAgent = availableAgents[0];
                            const effectiveContacts = Math.min(contacts.length, 10000);
                            const newContactsPerAgent = Math.floor(effectiveContacts / ((distributionSummary?.selectedAgents.length || 0) + 1));
                            
                            const updatedAgents = [...(distributionSummary?.selectedAgents || []), {
                              id: newAgent.id,
                              name: newAgent.name,
                              ramal: newAgent.ramal,
                              quantity: newContactsPerAgent
                            }];
                            
                            // Rebalancear todos os agentes
                            const rebalancedAgents = updatedAgents.map(agent => ({
                              ...agent,
                              quantity: newContactsPerAgent
                            }));
                            
                            setDistributionSummary(prev => prev ? {
                              ...prev,
                              selectedAgents: rebalancedAgents,
                              contactsPerAgent: newContactsPerAgent
                            } : null);
                            
                            // Atualizar selectedAgents state
                            const newSelectedAgents = { ...selectedAgents };
                            rebalancedAgents.forEach(agent => {
                              newSelectedAgents[agent.id] = { selected: true, quantity: newContactsPerAgent };
                            });
                            setSelectedAgents(newSelectedAgents);
                            
                            // Ativar modo de edição
                            setIsEditingDistribution(true);
                          }
                        }}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                        title="Adicionar agente"
                      >
                        +
                      </button>
                      
                      <button
                        onClick={() => setIsEditingDistribution(!isEditingDistribution)}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                        title="Remover agentes"
                      >
                        -
                      </button>
                      
                      {/* Botão de Confirmação - só aparece quando está editando */}
                      {isEditingDistribution && (
                        <button
                          onClick={() => setIsEditingDistribution(false)}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: '600'
                          }}
                          title="Confirmar alterações"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  position: 'relative',
                  zIndex: 1
                }}>
                  {distributionSummary.selectedAgents.map((agent, index) => (
                    <div key={agent.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(14, 165, 233, 0.3)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      boxShadow: '0 2px 4px rgba(14, 165, 233, 0.1)',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${
                          index % 3 === 0 ? '#3b82f6, #1d4ed8' :
                          index % 3 === 1 ? '#10b981, #059669' :
                          '#f59e0b, #d97706'
                        })`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: '600',
                        color: 'white'
                      }}>
                        {agent.name.charAt(0)}
                      </div>
                      <span style={{ fontWeight: '500', color: '#0c4a6e' }}>
                        {agent.name}
                      </span>
                      <span style={{ 
                        color: '#0369a1',
                        fontSize: '11px',
                        background: 'rgba(14, 165, 233, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        #{agent.ramal}
                      </span>
                      {agent.quantity && (
                        <span style={{
                          color: '#0c4a6e',
                          fontWeight: '600',
                          fontSize: '12px',
                          background: 'rgba(59, 130, 246, 0.1)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {agent.quantity.toLocaleString()}
                        </span>
                      )}
                      {distributionSummary.contactsPerAgent && !agent.quantity && (
                        <span style={{
                          color: '#0c4a6e',
                          fontWeight: '600',
                          fontSize: '12px',
                          background: 'rgba(59, 130, 246, 0.1)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          ~{Math.floor(Math.min(distributionSummary.totalContacts, 10000) / distributionSummary.selectedAgents.length).toLocaleString()}
                        </span>
                      )}
                      
                      {/* Botão X para remover agente (só aparece no modo de edição) */}
                      {isEditingDistribution && distributionSummary.selectedAgents.length > 1 && (
                        <button
                          onClick={() => {
                            // Remover agente da distribuição
                            const updatedAgents = distributionSummary.selectedAgents.filter(a => a.id !== agent.id);
                            const effectiveContacts = Math.min(contacts.length, 10000);
                            const newContactsPerAgent = Math.floor(effectiveContacts / updatedAgents.length);
                            
                            // Rebalancear todos os agentes restantes
                            const rebalancedAgents = updatedAgents.map(remainingAgent => ({
                              ...remainingAgent,
                              quantity: newContactsPerAgent
                            }));
                            
                            setDistributionSummary(prev => prev ? {
                              ...prev,
                              selectedAgents: rebalancedAgents,
                              contactsPerAgent: newContactsPerAgent
                            } : null);
                            
                            // Atualizar selectedAgents state
                            setSelectedAgents(prev => {
                              const updated = { ...prev };
                              delete updated[agent.id];
                              // Recalcular quantities para os agentes restantes
                              rebalancedAgents.forEach(remainingAgent => {
                                updated[remainingAgent.id] = { selected: true, quantity: newContactsPerAgent };
                              });
                              return updated;
                            });
                          }}
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                            border: '1px solid white',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: '600',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                          }}
                          title={`Remover ${agent.name}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vincular Agente - Ocultar quando distribuição configurada */}
            {!distributionConfigured && (
              <div style={{ marginBottom: '2rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '12px'
                }}>
                  Vincular Agente individual
                </label>
              
              <div className="agentsGrid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '12px'
              }}>
                {isLoadingAgents ? (
                  <div style={{ 
                    padding: '20px', 
                    textAlign: 'center', 
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #e2e8f0',
                      borderTop: '2px solid #3b82f6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Carregando agentes...
                  </div>
                ) : agents.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                    Nenhum agente encontrado
                  </div>
                ) : agents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                    style={{
                      padding: '16px 20px',
                      border: `2px solid ${selectedAgent === agent.id ? '#6366f1' : '#f1f5f9'}`,
                      borderRadius: '16px',
                      background: selectedAgent === agent.id ? '#f8fafc' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedAgent !== agent.id) {
                        e.currentTarget.style.borderColor = '#c7d2fe';
                        e.currentTarget.style.background = '#f8fafc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedAgent !== agent.id) {
                        e.currentTarget.style.borderColor = '#f1f5f9';
                        e.currentTarget.style.background = 'white';
                      }
                    }}
                  >
                    {selectedAgent === agent.id && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <CheckCircle size={12} style={{ color: 'white' }} />
                      </div>
                    )}
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'white'
                      }}>
                        {agent.name.split(' ')[0][0]}{agent.name.split(' ')[1]?.[0] || ''}
                      </div>
                      
                      <div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '2px'
                        }}>
                          {agent.name} - Ramal {agent.ramal}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#64748b'
                        }}>
                          Ramal: {agent.ramal}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}


          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Upload de Contatos */}
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: '1.5rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
              border: '1px solid #f1f5f9'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Users size={18} />
                Lista de Contatos
              </h3>
              {csvAnalysis ? (
                <div className="previewTableWrap" style={{
                  overflowX: 'auto',
                  overflowY: 'auto',
                  maxHeight: 'clamp(260px, 60vh, 540px)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: 'white',
                  maxWidth: '100%'
                }}>
                  <table style={{
                    width: 'max-content',
                    borderCollapse: 'collapse',
                    fontSize: '12px',
                    tableLayout: 'auto',
                    whiteSpace: 'nowrap'
                  }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        {csvAnalysis.headers.map((header, index) => (
                          <th key={index} style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            borderBottom: '1px solid #e2e8f0',
                            fontWeight: '600',
                            color: '#374151'
                          }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvAnalysis.preview.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid #f1f5f9',
                              color: '#64748b'
                            }}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  className="uploadDropzone"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  style={{
                    border: `2px dashed ${isDragOver ? '#6366f1' : '#e2e8f0'}`,
                    borderRadius: '16px',
                    padding: '2rem 1rem',
                    textAlign: 'center',
                    backgroundColor: isDragOver ? '#e3f2fd' : '#fafbfc',
                    borderColor: isDragOver ? '#2196f3' : '#e0e7ff',
                    cursor: 'pointer'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  {isProcessingFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#1976d2' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid #e3f2fd',
                        borderTop: '2px solid #1976d2',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Processando arquivo...
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Upload size={24} color="white" />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                          Clique ou arraste um arquivo
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                          CSV, Excel (.xlsx, .xls)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Contador de Contatos */}
            {contacts.length > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                borderRadius: '20px',
                padding: '1.5rem',
                color: '#0c4a6e',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                boxShadow: 'rgba(14, 165, 233, 0.1) 0px 2px 4px'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-20px',
                  right: '-20px',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.9)',
                  opacity: 0.6
                }} />
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <CheckCircle size={20} />
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      margin: 0
                    }}>
                      Contatos Carregados
                    </h3>
                  </div>
                  
                  <button
                    onClick={() => handleSave('active')}
                    disabled={
                      !campaignName.trim() || 
                      !distributionConfigured || 
                      (contacts.length === 0 && fullRecords.length === 0) || 
                      !uploadedFile ||
                      isSaving
                    }
                    style={{
                      background: (
                        !campaignName.trim() || 
                        !distributionConfigured || 
                        (contacts.length === 0 && fullRecords.length === 0) || 
                        !uploadedFile ||
                        isSaving
                      ) ? 'linear-gradient(135deg, #9ca3af, #6b7280)' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: (
                        !campaignName.trim() || 
                        !distributionConfigured || 
                        (contacts.length === 0 && fullRecords.length === 0) || 
                        !uploadedFile ||
                        isSaving
                      ) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease',
                      opacity: (
                        !campaignName.trim() || 
                        !distributionConfigured || 
                        (contacts.length === 0 && fullRecords.length === 0) || 
                        !uploadedFile ||
                        isSaving
                      ) ? 0.6 : 1,
                      minWidth: '140px',
                      boxShadow: (
                        !campaignName.trim() || 
                        !distributionConfigured || 
                        (contacts.length === 0 && fullRecords.length === 0) || 
                        !uploadedFile ||
                        isSaving
                      ) ? 'none' : '0 4px 12px rgba(14, 165, 233, 0.3)',
                      transform: isSaving ? 'none' : 'translateY(0)',
                    }}
                    onMouseEnter={(e) => {
                      if (!e.currentTarget.disabled && !isSaving) {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(14, 165, 233, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSaving) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.3)';
                      }
                    }}
                  >
                    {isSaving ? (
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    ) : (
                      <Send size={16} />
                    )}
                    {isSaving ? 'Salvando...' : 'Criar'}
                  </button>
                </div>
              </div>
            )}

            {/* Barra de Progresso */}
            {isSaving && (
              <div style={{
                background: 'white',
                borderRadius: '20px',
                padding: '1.5rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                border: '1px solid #f1f5f9',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    {saveStep}
                  </span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#3b82f6'
                  }}>
                    {saveProgress}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '12px',
                  background: 'linear-gradient(90deg, #f1f5f9, #e2e8f0)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    width: `${saveProgress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
                    borderRadius: '6px',
                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: saveProgress > 0 ? '0 0 12px rgba(59, 130, 246, 0.5)' : 'none',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                      animation: saveProgress > 0 && saveProgress < 100 ? 'shimmer 2s infinite' : 'none'
                    }} />
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Modal de Sucesso */}
        {showSuccessModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              transform: 'scale(1)',
              animation: 'modalFadeIn 0.3s ease-out'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                animation: 'checkmarkBounce 0.6s ease-out'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
              </div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937',
                margin: '0 0 0.5rem 0'
              }}>
                Sucesso!
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                margin: '0 0 1.5rem 0',
                lineHeight: '1.5'
              }}>
                {modalMessage}
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '100px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Modal de Erro */}
        {showErrorModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              transform: 'scale(1)',
              animation: 'modalFadeIn 0.3s ease-out'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                animation: 'errorShake 0.6s ease-out'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937',
                margin: '0 0 0.5rem 0'
              }}>
                Atenção!
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                margin: '0 0 1.5rem 0',
                lineHeight: '1.5',
                whiteSpace: 'pre-line'
              }}>
                {modalMessage}
              </p>
              <button
                onClick={() => setShowErrorModal(false)}
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '100px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Entendi
              </button>
            </div>
          </div>
        )}

        {/* Modal de Informação */}
        {showInfoModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '450px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              transform: 'scale(1)',
              animation: 'modalFadeIn 0.3s ease-out'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                animation: 'infoBounce 0.6s ease-out'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="m9,12 2,2 4,-4"></path>
                </svg>
              </div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937',
                margin: '0 0 0.5rem 0'
              }}>
                Processamento Concluído
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                margin: '0 0 1.5rem 0',
                lineHeight: '1.6',
                whiteSpace: 'pre-line'
              }}>
                {modalMessage}
              </p>
              <button
                onClick={() => setShowInfoModal(false)}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '100px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Modal de Distribuição */}
        <DistributionModal
          isOpen={showDistributionModal}
          onClose={() => {
            setShowDistributionModal(false);
            // Não resetar estados quando cancelar - manter distribuição configurada se já existir
          }}
          onConfirm={() => {
            // Capturar informações da configuração
            const selectedColumns = csvAnalysis?.headers.filter((_, index) => {
              const mapping = columnMapping as any;
              return Object.values(mapping).includes(index);
            }) || [];
            
            let selectedAgentsList: Array<{id: string; name: string; ramal: string; quantity?: number}> = [];
            let contactsPerAgent: number | undefined;
            
            if (distributionMode === 'single' && selectedAgent) {
              const agent = agents.find(a => a.id === selectedAgent);
              if (agent) {
                selectedAgentsList = [{
                  id: agent.id,
                  name: agent.name,
                  ramal: agent.ramal,
                  quantity: fullRecords.length
                }];
              }
            } else if (distributionMode === 'multiple') {
              selectedAgentsList = Object.entries(selectedAgents)
                .filter(([_, data]) => data.selected)
                .map(([agentId, data]) => {
                  const agent = agents.find(a => a.id === agentId);
                  return {
                    id: agentId,
                    name: agent?.name || 'Agente',
                    ramal: agent?.ramal || '0000',
                    quantity: data.quantity
                  };
                });
              
              if (agentDistribution === 'automatic' && selectedAgentsList.length > 0) {
                contactsPerAgent = Math.floor(fullRecords.length / selectedAgentsList.length);
              }
            }
            
            setDistributionSummary({
              mode: distributionMode,
              selectedColumns,
              selectedAgents: selectedAgentsList,
              totalContacts: fullRecords.length,
              contactsPerAgent
            });
            
            setShowDistributionModal(false);
            setDistributionConfigured(true);
            setModalMessage('Distribuição configurada com sucesso! Agora você pode salvar a campanha.');
            setShowInfoModal(true);
          }}
          agents={agents}
          totalContacts={fullRecords.length}
          distributionMode={distributionMode}
          setDistributionMode={setDistributionMode}
          agentDistribution={agentDistribution}
          setAgentDistribution={setAgentDistribution}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          selectedAgents={selectedAgents}
          setSelectedAgents={setSelectedAgents}
        />

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          
          @keyframes modalFadeIn {
            0% { 
              opacity: 0; 
              transform: scale(0.9) translateY(-10px); 
            }
            100% { 
              opacity: 1; 
              transform: scale(1) translateY(0); 
            }
          }
          
          @keyframes checkmarkBounce {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
          
          @keyframes errorShake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }
          
          @keyframes infoBounce {
            0% { transform: scale(0); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }

          .pageContainer { box-sizing: border-box; width: 100%; }
          .mainGrid { width: 100%; }
          .previewTableWrap { width: 100%; max-width: 100%; }
          .previewTableWrap table { width: 100%; table-layout: auto; }
          .previewTableWrap th, .previewTableWrap td { white-space: nowrap; }
          .previewTableWrap thead th { position: sticky; top: 0; background: #f1f5f9; }

          @media (max-width: 1280px) {
            .pageContainer { padding: 1.5rem; }
          }

          @media (max-width: 1024px) {
            .pageContainer { padding: 1rem; overflow-x: hidden; }
            .mainGrid { grid-template-columns: 1fr !important; gap: 1.25rem !important; }
            .previewTableWrap { overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100vw; }
            /* Stack internal grids to avoid overflow */
            .mappingGrid { grid-template-columns: 1fr !important; }
            .agentsGrid { grid-template-columns: 1fr !important; }
            .uploadDropzone { padding: 1.25rem 0.75rem !important; }
          }

          @media (max-width: 640px) {
            .pageContainer { padding: 0.75rem; }
            .previewTableWrap table { min-width: 600px; }
          }
        `}</style>
      </div>
    </MainLayout>
  );
}
