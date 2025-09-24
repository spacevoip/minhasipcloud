'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/components/ui/toast';
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Shield, 
  Bell, 
  Globe, 
  Palette,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';

export default function ResellerConfigPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Estados do formulário
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    whatsapp: user?.phone || '',
    company: user?.company || '',
    timezone: 'America/Sao_Paulo',
    language: 'pt-BR'
  });

  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    browserNotifications: true,
    soundNotifications: true,
    clientUpdates: true,
    systemAlerts: true,
    financialAlerts: true
  });

  // Carregar dados do usuário
  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        whatsapp: user.phone || '',
        company: user.company || ''
      }));
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simular atualização de perfil
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Sucesso', 'Perfil atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro', 'Erro ao atualizar perfil. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error('Erro', 'As senhas não coincidem.');
      return;
    }

    if (securityData.newPassword.length < 6) {
      toast.error('Erro', 'A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsLoading(true);

    try {
      // Simular alteração de senha
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSecurityData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      toast.success('Sucesso', 'Senha alterada com sucesso!');
    } catch (error) {
      toast.error('Erro', 'Erro ao alterar senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simular atualização de notificações
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Sucesso', 'Configurações de notificação atualizadas!');
    } catch (error) {
      toast.error('Erro', 'Erro ao atualizar configurações. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const isTablet = typeof window !== 'undefined' && window.innerWidth <= 1024;

  const containerStyle = {
    padding: isMobile ? '1rem' : isTablet ? '1.5rem' : '2rem',
    maxWidth: '1200px',
    margin: '0 auto',
    minHeight: '100vh'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: isMobile ? '1.5rem' : '2rem'
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: '1rem',
    padding: isMobile ? '1.5rem' : '2rem',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  };

  const inputStyle = {
    width: '100%',
    maxWidth: '100%',
    padding: '0.75rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box' as const
  };

  const formGridStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap: '1rem'
  };

  return (
    <MainLayout>
      <div style={containerStyle}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem',
          textAlign: isMobile ? 'center' : 'left'
        }}>
          <h1 style={{
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: 'bold',
            color: '#1e293b',
            marginBottom: '0.5rem'
          }}>
            Configurações do Revendedor
          </h1>
          <p style={{
            color: '#64748b',
            fontSize: isMobile ? '0.875rem' : '1rem'
          }}>
            Gerencie suas configurações pessoais, segurança e preferências
          </p>
        </div>

        <div style={gridStyle}>
          {/* Informações do Perfil */}
          <div style={cardStyle}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                borderRadius: '0.75rem',
                color: 'white'
              }}>
                <User style={{ width: '1.25rem', height: '1.25rem' }} />
              </div>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#1e293b'
              }}>
                Informações do Perfil
              </h2>
            </div>

            <form onSubmit={handleProfileSubmit}>
              <div style={{
                display: 'grid',
                gap: '1.5rem'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    style={{
                      ...inputStyle
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    style={{
                      ...inputStyle
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={profileData.whatsapp}
                    onChange={(e) => setProfileData({ ...profileData, whatsapp: e.target.value })}
                    style={{
                      ...inputStyle
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Empresa
                  </label>
                  <input
                    type="text"
                    value={profileData.company}
                    onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                    style={{
                      ...inputStyle
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Save style={{ width: '1rem', height: '1rem' }} />
                  {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>

          {/* Segurança */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(226, 232, 240, 0.8)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                borderRadius: '0.75rem',
                color: 'white'
              }}>
                <Shield style={{ width: '1.25rem', height: '1.25rem' }} />
              </div>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#1e293b'
              }}>
                Segurança
              </h2>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <div style={{
                display: 'grid',
                gap: '1.5rem'
              }}>


                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    value={securityData.newPassword}
                    onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                    style={{
                      ...inputStyle
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    value={securityData.confirmPassword}
                    onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                    style={{
                      ...inputStyle
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Shield style={{ width: '1rem', height: '1rem' }} />
                  {isLoading ? 'Alterando...' : 'Alterar Senha'}
                </button>
              </div>
            </form>
          </div>

          {/* Notificações */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            gridColumn: 'span 2'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                borderRadius: '0.75rem',
                color: 'white'
              }}>
                <Bell style={{ width: '1.25rem', height: '1.25rem' }} />
              </div>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#1e293b'
              }}>
                Configurações de Notificação
              </h2>
            </div>

            <form onSubmit={handleNotificationSubmit}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {[
                  { key: 'emailNotifications', label: 'Notificações por Email', desc: 'Receber alertas por email' },
                  { key: 'browserNotifications', label: 'Notificações do Navegador', desc: 'Alertas no navegador' },
                  { key: 'soundNotifications', label: 'Notificações Sonoras', desc: 'Sons de alerta' },
                  { key: 'clientUpdates', label: 'Atualizações de Clientes', desc: 'Novos clientes e alterações' },
                  { key: 'systemAlerts', label: 'Alertas do Sistema', desc: 'Problemas técnicos' },
                  { key: 'financialAlerts', label: 'Alertas Financeiros', desc: 'Pagamentos e faturas' }
                ].map((setting) => (
                  <div key={setting.key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    background: 'rgba(248, 250, 252, 0.8)',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(226, 232, 240, 0.8)'
                  }}>
                    <div>
                      <div style={{
                        fontWeight: '500',
                        color: '#1e293b',
                        marginBottom: '0.25rem'
                      }}>
                        {setting.label}
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#64748b'
                      }}>
                        {setting.desc}
                      </div>
                    </div>
                    <label style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: '3rem',
                      height: '1.5rem',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={notificationSettings[setting.key as keyof typeof notificationSettings]}
                        onChange={(e) => setNotificationSettings({
                          ...notificationSettings,
                          [setting.key]: e.target.checked
                        })}
                        style={{
                          opacity: 0,
                          width: 0,
                          height: 0
                        }}
                      />
                      <span style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: notificationSettings[setting.key as keyof typeof notificationSettings] ? '#10b981' : '#cbd5e1',
                        borderRadius: '1.5rem',
                        transition: 'all 0.2s ease'
                      }}>
                        <span style={{
                          position: 'absolute',
                          content: '',
                          height: '1.125rem',
                          width: '1.125rem',
                          left: notificationSettings[setting.key as keyof typeof notificationSettings] ? '1.5rem' : '0.1875rem',
                          bottom: '0.1875rem',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                        }} />
                      </span>
                    </label>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  padding: '0.75rem 2rem',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Save style={{ width: '1rem', height: '1rem' }} />
                {isLoading ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
