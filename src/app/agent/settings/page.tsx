'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AgentLayout } from '@/components/layout/agent-layout';
import { agentAuthService, type AgentData } from '@/services/agentAuthService';
import { User, Phone, Shield, Eye, EyeOff, Wifi, Save } from 'lucide-react';

// Using AgentData from the service instead of local interface

interface FormData {
  caller_id: string;
}

interface PasswordData {
  newPassword: string;
  confirmPassword: string;
}

export default function AgentSettings() {
  const router = useRouter();
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [formData, setFormData] = useState<FormData>({ caller_id: '' });
  const [passwordData, setPasswordData] = useState<PasswordData>({
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<'online' | 'offline'>('offline');

  useEffect(() => {
    loadAgentData();
  }, []);

  const loadAgentData = async () => {
    try {
      console.log('🔄 [Settings] Carregando dados do agente...');
      
      const result = await agentAuthService.getCurrentAgent();
      console.log('📋 [Settings] Resultado getCurrentAgent:', result);
      
      if (result.success && result.data) {
        console.log('✅ [Settings] Dados do agente carregados:', {
          nome: result.data.agente_name,
          ramal: result.data.ramal,
          id: result.data.id
        });
        
        setAgentData(result.data);
        setFormData({ caller_id: result.data.callerid || '' });
        
        // Verificar se ramal existe antes de fazer chamadas
        if (result.data.ramal) {
          await loadAgentWithStatus(result.data.ramal);
        } else {
          console.warn('⚠️ [Settings] Ramal não encontrado nos dados do agente');
        }
      } else {
        console.log('⚠️ [Settings] Tentando dados armazenados...');
        const storedData = agentAuthService.getStoredAgentData();
        console.log('💾 [Settings] Dados armazenados:', storedData);
        
        if (storedData && storedData.ramal) {
          setAgentData(storedData);
          setFormData({ caller_id: storedData.callerid || '' });
          await loadAgentWithStatus(storedData.ramal);
        } else {
          console.error('❌ [Settings] Nenhum dado válido encontrado');
          router.push('/login');
          return;
        }
      }
    } catch (error) {
      console.error('Error loading agent data:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadAgentWithStatus = async (ramal: string) => {
    try {
      if (!ramal || ramal === 'undefined') {
        console.warn('⚠️ [Settings] Ramal inválido:', ramal);
        return;
      }

      const token = localStorage.getItem('agent_token');
      if (!token) {
        console.warn('⚠️ [Settings] Token não encontrado');
        return;
      }

      console.log('🔍 [Settings] Buscando status do ramal:', ramal);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/agents/ramal/${ramal}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Update extension status from backend
          setExtensionStatus(data.data.liveStatus === 'online' ? 'online' : 'offline');
          console.log('✅ [Settings] Status SIP atualizado:', data.data.liveStatus);
        }
      } else {
        console.error('❌ [Settings] Erro na API:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading agent status:', error);
    }
  };

  const handleSave = async () => {
    if (!agentData) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/${agentData.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          callerid: formData.caller_id
        })
      });

      if (response.ok) {
        const updatedAgent = { ...agentData, callerid: formData.caller_id };
        setAgentData(updatedAgent);
        alert('Caller ID atualizado com sucesso!');
      } else {
        alert('Erro ao atualizar Caller ID');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const validatePassword = (password: string) => {
    const hasMinLength = password.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    return { hasMinLength, hasLetter, isValid: hasMinLength && hasLetter };
  };

  const getPasswordStrength = (password: string) => {
    const validation = validatePassword(password);
    if (!password) return { strength: 0, text: '', color: '#e5e7eb' };
    if (!validation.hasMinLength) return { strength: 1, text: 'Muito fraca', color: '#ef4444' };
    if (!validation.hasLetter) return { strength: 2, text: 'Fraca', color: '#f59e0b' };
    return { strength: 3, text: 'Forte', color: '#10b981' };
  };

  const handlePasswordChange = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      alert('Preencha todos os campos de senha');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Nova senha e confirmação não coincidem');
      return;
    }

    const validation = validatePassword(passwordData.newPassword);
    if (!validation.isValid) {
      alert('A senha deve ter pelo menos 8 caracteres e conter pelo menos 1 letra');
      return;
    }

    setPasswordLoading(true);
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newPassword: passwordData.newPassword
        })
      });

      if (response.ok) {
        setPasswordData({ newPassword: '', confirmPassword: '' });
        alert('Senha alterada com sucesso!');
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Erro ao alterar senha');
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      alert('Erro ao alterar senha');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <AgentLayout>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '50vh',
          fontSize: '18px',
          color: '#64748b'
        }}>
          Carregando...
        </div>
      </AgentLayout>
    );
  }

  if (!agentData) {
    return (
      <AgentLayout>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '50vh',
          fontSize: '18px',
          color: '#ef4444'
        }}>
          Erro ao carregar dados do agente
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout>
      <div style={{ 
        padding: '80px 16px 16px 16px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: '700', 
            color: '#1e293b',
            margin: 0,
            marginBottom: '8px'
          }}>
            Configurações
          </h1>
          <p style={{ 
            fontSize: '16px', 
            color: '#64748b',
            margin: 0
          }}>
            Gerencie suas informações pessoais e configurações de segurança
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '20px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Left Column */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px', 
            minWidth: '0',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {/* Agent Information */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              width: '100%',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: '#1e293b',
                margin: 0,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <User size={20} />
                Informações Pessoais
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Nome do Agente
                  </label>
                  <p style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    margin: '4px 0 8px 0',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word'
                  }}>
                    {agentData.agente_name}
                  </p>
                  <p style={{ 
                    fontSize: '12px', 
                    color: '#64748b',
                    margin: 0
                  }}>
                    O nome do agente não pode ser alterado
                  </p>
                </div>
                
                <div>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Usuário Vinculado
                  </label>
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px'
                  }}>
                    <User size={16} color="#64748b" />
                    <span style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#1e293b',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word'
                    }}>
                      {agentData.user_name || `ID: ${agentData.user_id}`}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#374151',
                    marginBottom: '6px',
                    display: 'block'
                  }}>
                    Caller ID
                  </label>
                  <input
                    type="text"
                    value={formData.caller_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, caller_id: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                      minWidth: '0'
                    }}
                    placeholder="Ex: João Silva <1001>"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      background: saving ? '#9ca3af' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '8px'
                    }}
                  >
                    {saving ? (
                      <>
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid #ffffff40',
                          borderTop: '2px solid #ffffff',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        Salvar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Extension Status */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              height: 'fit-content',
              width: '100%',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: '#1e293b',
                margin: 0,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Phone size={20} />
                Status do Ramal
              </h2>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                gap: '16px',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <div>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Número
                  </label>
                  <p style={{ 
                    fontSize: '18px', 
                    fontWeight: '700', 
                    color: '#1e293b',
                    margin: '4px 0 0 0'
                  }}>
                    {agentData?.ramal || '----'}
                  </p>
                </div>
                
                <div>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Status SIP
                  </label>
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: extensionStatus === 'online' ? '#10b981' : '#ef4444'
                    }} />
                    <span style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#1e293b',
                      textTransform: 'capitalize'
                    }}>
                      {extensionStatus}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    WebRTC
                  </label>
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px'
                  }}>
                    <Wifi size={16} color={agentData?.webrtc ? '#10b981' : '#64748b'} />
                    <span style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#1e293b'
                    }}>
                      {agentData?.webrtc ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px', 
            minWidth: '0',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {/* Password Change */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              width: '100%',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: '#1e293b',
                margin: 0,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Shield size={20} />
                Alterar Senha
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <div>
                  <label style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#374151',
                    marginBottom: '6px',
                    display: 'block'
                  }}>
                    Nova Senha
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px 40px 12px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        boxSizing: 'border-box',
                        minWidth: '0'
                      }}
                      placeholder="Digite a nova senha"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#6b7280'
                      }}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {passwordData.newPassword && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px'
                      }}>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: getPasswordStrength(passwordData.newPassword).color
                        }}>
                          {getPasswordStrength(passwordData.newPassword).text}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          color: '#64748b'
                        }}>
                          Mín. 8 caracteres, 1 letra
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '4px',
                        background: '#e5e7eb',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(getPasswordStrength(passwordData.newPassword).strength / 3) * 100}%`,
                          height: '100%',
                          background: getPasswordStrength(passwordData.newPassword).color,
                          transition: 'all 0.3s ease'
                        }} />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#374151',
                    marginBottom: '6px',
                    display: 'block'
                  }}>
                    Confirmar Nova Senha
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px 40px 12px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        boxSizing: 'border-box',
                        minWidth: '0'
                      }}
                      placeholder="Confirme a nova senha"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#6b7280'
                      }}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handlePasswordChange}
                  disabled={passwordLoading}
                  style={{
                    background: passwordLoading ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: passwordLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s',
                    marginTop: '8px'
                  }}
                >
                  {passwordLoading ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #ffffff40',
                        borderTop: '2px solid #ffffff',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Alterando...
                    </>
                  ) : (
                    <>
                      <Shield size={16} />
                      Alterar Senha
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AgentLayout>
  );
}
