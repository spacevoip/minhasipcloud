'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { agentsService, type Agent } from '@/services/agentsService';
import { useAuth } from '@/hooks/useAuth';
import { 
  Music, 
  Plus, 
  Play, 
  Pause, 
  Star, 
  StarOff,
  Trash2, 
  X, 
  Check, 
  Upload, 
  AlertCircle,
  Search
} from 'lucide-react';

interface AudioFile {
  id: string;
  name: string;
  file_path: string;
  created_at: string;
  agent_id?: string;
  user_id: string;
  agent_name?: string;
}

export default function AudiosPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [currentAudioElement, setCurrentAudioElement] = useState<HTMLAudioElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  

  // Carregar dados iniciais
  useEffect(() => {
    loadAgents();
    loadAudioFiles();
  }, []);

  const loadAgents = async () => {
    try {
      const agentsList = await agentsService.getAgents();
      setAgents(agentsList);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
    }
  };

  const loadAudioFiles = async () => {
    try {
      setLoading(true);
      
      // Obter token JWT do localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('Token não encontrado');
        return;
      }

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE}/api/audios/list`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (response.ok) {
        setAudioFiles(data.audios || []);
      } else {
        console.error('Erro ao carregar áudios:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar áudios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAudio = async (audioId: string) => {
    // Se já está tocando este áudio, pausar
    if (playingAudio === audioId && currentAudioElement) {
      currentAudioElement.pause();
      setPlayingAudio(null);
      setCurrentAudioElement(null);
      return;
    }

    // Se há outro áudio tocando, parar primeiro
    if (currentAudioElement) {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
      setCurrentAudioElement(null);
    }

    const audio = audioFiles.find(a => a.id === audioId);
    if (!audio) return;

    try {
      setPlayingAudio(audioId);
      
      // Obter token JWT do localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Token não encontrado. Faça login novamente.');
        setPlayingAudio(null);
        return;
      }
      
      // Criar URL absoluta para o backend e usar ID do áudio (não file_path)
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const audioUrl = `${API_BASE}/api/audios/play/${audio.id}`;
      
      // Fazer fetch primeiro para verificar autenticação
      const response = await fetch(audioUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        alert('Erro ao acessar áudio');
        setPlayingAudio(null);
        return;
      }
      
      // Converter response para blob e criar URL
      const audioBlob = await response.blob();
      const audioObjectUrl = URL.createObjectURL(audioBlob);
      
      // Criar elemento de áudio e reproduzir
      const audioElement = new Audio(audioObjectUrl);
      
      // Configurar eventos
      audioElement.onended = () => {
        setPlayingAudio(null);
        setCurrentAudioElement(null);
        URL.revokeObjectURL(audioObjectUrl);
      };
      
      audioElement.onerror = () => {
        setPlayingAudio(null);
        setCurrentAudioElement(null);
        URL.revokeObjectURL(audioObjectUrl);
        alert('Erro ao reproduzir áudio');
      };
      
      audioElement.onpause = () => {
        if (playingAudio === audioId) {
          setPlayingAudio(null);
        }
      };
      
      audioElement.onplay = () => {
        setPlayingAudio(audioId);
      };
      
      // Salvar referência do elemento
      setCurrentAudioElement(audioElement);
      
      // Reproduzir
      await audioElement.play();
    } catch (error) {
      setPlayingAudio(null);
      setCurrentAudioElement(null);
      alert('Erro ao reproduzir áudio');
    }
  };

  const handleDeleteAudio = async (audioId: string) => {
    if (!confirm('Tem certeza que deseja deletar este áudio?')) {
      return;
    }

    try {
      const audio = audioFiles.find(a => a.id === audioId);
      if (!audio) return;

      // Obter token JWT do localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Token não encontrado. Faça login novamente.');
        return;
      }

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE}/api/audios/${audioId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (response.ok) {
        setAudioFiles(prev => prev.filter(a => a.id !== audioId));
        // Recarregar lista para sincronizar
        loadAudioFiles();
      } else {
        alert(result.error || 'Erro ao deletar áudio');
      }
    } catch (error) {
      console.error('Erro ao deletar áudio:', error);
      alert('Erro ao deletar áudio');
    }
  };


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
      if (!allowedTypes.includes(file.type)) {
        setUploadError('Formato não suportado. Use WAV, MP3 ou OGG.');
        return;
      }
      
      // Validar tamanho (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('Arquivo muito grande. Máximo 10MB.');
        return;
      }

      setSelectedFile(file);
      setUploadName(file.name.replace(/\.[^/.]+$/, '')); // Remove extensão
      setUploadError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadName.trim()) {
      setUploadError('Selecione um arquivo e informe o nome.');
      return;
    }


    try {
      const currentUserId = user?.id || 'anonymous';
      
      // Criar FormData para envio
      const formData = new FormData();
      formData.append('audio', selectedFile); // Campo correto esperado pelo backend
      formData.append('name', uploadName);
      formData.append('userId', currentUserId);

      // Obter token JWT do localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        setUploadError('Token não encontrado. Faça login novamente.');
        return;
      }

      // Enviar para API
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE}/api/audios/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        setUploadError(result.error || 'Erro ao fazer upload');
        return;
      }

      // Recarregar lista de áudios para sincronizar
      loadAudioFiles();
      
      // Reset modal
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadName('');
      setUploadError('');
      
    } catch (error) {
      setUploadError('Erro ao fazer upload do arquivo.');
    }
  };

  const filteredAudios = audioFiles.filter(audio => 
    audio.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <MainLayout>
      <div style={{
        padding: '2rem',
        maxWidth: '1400px',
        margin: '0 auto',
        minHeight: '100vh'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}>
              <Music style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
            </div>
            <div>
              <h1 style={{
                fontSize: '2rem',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0
              }}>
                Gerenciar Áudios
              </h1>
              <p style={{
                fontSize: '1rem',
                color: '#64748b',
                margin: 0
              }}>
                Gerencie áudios dos seus agentes
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Upload style={{ width: '1rem', height: '1rem' }} />
            Upload Áudio
          </button>
        </div>

        {/* Busca */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <Search style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '1rem',
              height: '1rem',
              color: '#64748b'
            }} />
            <input
              type="text"
              placeholder="Buscar áudios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'rgba(248, 250, 252, 0.8)'
              }}
            />
          </div>
        </div>

        {/* Tabela de Áudios */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '1.5rem',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          overflowX: 'auto'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            color: '#1e293b',
            margin: '0 0 1.5rem 0'
          }}>
            Áudios ({filteredAudios.length})
          </h3>

          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem',
              color: '#64748b'
            }}>
              Carregando áudios...
            </div>
          ) : filteredAudios.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem',
              color: '#64748b'
            }}>
              Nenhum áudio encontrado
            </div>
          ) : (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{
                  borderBottom: '2px solid rgba(226, 232, 240, 0.8)'
                }}>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151'
                  }}>Nome</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151'
                  }}>Data</th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151'
                  }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudios.map((audio) => (
                  <tr
                    key={audio.id}
                    style={{
                      borderBottom: '1px solid rgba(226, 232, 240, 0.5)',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(248, 250, 252, 0.8)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{
                      padding: '1rem 0.75rem',
                      fontSize: '0.875rem',
                      color: '#1e293b',
                      fontWeight: '500'
                    }}>
                      {audio.name}
                    </td>
                    <td style={{
                      padding: '1rem 0.75rem',
                      fontSize: '0.875rem',
                      color: '#64748b'
                    }}>
                      {formatDate(audio.created_at)}
                    </td>
                    <td style={{
                      padding: '1rem 0.75rem',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}>
                        <button
                          onClick={() => handlePlayAudio(audio.id)}
                          style={{
                            padding: '0.5rem',
                            background: playingAudio === audio.id ? '#ef4444' : '#10b981',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title={playingAudio === audio.id ? 'Pausar' : 'Reproduzir'}
                        >
                          {playingAudio === audio.id ? 
                            <Pause style={{ width: '1rem', height: '1rem' }} /> :
                            <Play style={{ width: '1rem', height: '1rem' }} />
                          }
                        </button>


                        <button
                          onClick={() => handleDeleteAudio(audio.id)}
                          style={{
                            padding: '0.5rem',
                            background: '#ef4444',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Excluir áudio"
                        >
                          <Trash2 style={{ width: '1rem', height: '1rem' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal de Upload */}
        {showUploadModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
              borderRadius: '20px',
              padding: '2.5rem',
              width: '100%',
              maxWidth: '520px',
              border: '1px solid rgba(226, 232, 240, 0.5)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.8)',
              position: 'relative',
              transform: 'scale(1)',
              animation: 'modalSlideIn 0.3s ease-out'
            }}>
              {/* Header com ícone */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '2rem'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '1rem'
                }}>
                  <Upload style={{ width: '24px', height: '24px', color: 'white' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: '#1e293b',
                    margin: '0 0 0.25rem 0'
                  }}>
                    Novo Áudio
                  </h3>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#64748b',
                    margin: 0
                  }}>
                    Faça upload de um arquivo de áudio
                  </p>
                </div>
                <button
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    padding: '0.5rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: '#ef4444',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.background = 'rgba(239, 68, 68, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = 'rgba(239, 68, 68, 0.1)';
                  }}
                >
                  <X style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>
              </div>

              {/* Formulário */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Nome do áudio */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Nome do Áudio *
                  </label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    placeholder="Ex: mensagem-boas-vindas"
                    style={{
                      width: '100%',
                      padding: '0.875rem 1rem',
                      border: '2px solid rgba(226, 232, 240, 0.8)',
                      borderRadius: '12px',
                      fontSize: '0.875rem',
                      background: 'white',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea';
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(226, 232, 240, 0.8)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Upload de arquivo */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Arquivo de Áudio *
                  </label>
                  <div style={{
                    position: 'relative',
                    border: '2px dashed rgba(102, 126, 234, 0.3)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    textAlign: 'center',
                    background: 'rgba(102, 126, 234, 0.02)',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileSelect}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        background: 'rgba(102, 126, 234, 0.1)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Music style={{ width: '20px', height: '20px', color: '#667eea' }} />
                      </div>
                      <div>
                        <p style={{
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: '#374151',
                          margin: '0 0 0.25rem 0'
                        }}>
                          {selectedFile ? selectedFile.name : 'Clique para selecionar'}
                        </p>
                        <p style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          margin: 0
                        }}>
                          WAV, MP3 ou OGG (máx. 10MB)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>


                {/* Mensagem de erro */}
                {uploadError && (
                  <div style={{
                    padding: '1rem',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px',
                    color: '#dc2626',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <AlertCircle style={{ width: '1rem', height: '1rem', flexShrink: 0 }} />
                    {uploadError}
                  </div>
                )}

                {/* Botões */}
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  marginTop: '1rem'
                }}>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    style={{
                      flex: 1,
                      padding: '0.875rem 1.5rem',
                      background: 'white',
                      border: '2px solid rgba(226, 232, 240, 0.8)',
                      borderRadius: '12px',
                      color: '#6b7280',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.background = '#f8fafc';
                      (e.target as HTMLElement).style.borderColor = '#94a3b8';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.background = 'white';
                      (e.target as HTMLElement).style.borderColor = 'rgba(226, 232, 240, 0.8)';
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!selectedFile || !uploadName.trim()}
                    style={{
                      flex: 1,
                      padding: '0.875rem 1.5rem',
                      background: (!selectedFile || !uploadName.trim()) 
                        ? 'rgba(107, 114, 128, 0.3)' 
                        : 'linear-gradient(135deg, #667eea, #764ba2)',
                      border: 'none',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: (!selectedFile || !uploadName.trim()) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s',
                      opacity: (!selectedFile || !uploadName.trim()) ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => {
                      const target = e.target as HTMLButtonElement;
                      if (!target.disabled) {
                        target.style.transform = 'translateY(-1px)';
                        target.style.boxShadow = '0 10px 25px -5px rgba(102, 126, 234, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const target = e.target as HTMLButtonElement;
                      if (!target.disabled) {
                        target.style.transform = 'translateY(0)';
                        target.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <Upload style={{ width: '1rem', height: '1rem' }} />
                    Fazer Upload
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
