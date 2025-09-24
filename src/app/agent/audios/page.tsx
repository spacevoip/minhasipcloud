'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Play, 
  Pause, 
  Trash2, 
  Star, 
  Calendar,
  Music,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';
import { AgentLayout } from '@/components/layout/agent-layout';
import { agentAuthService, type AgentData } from '@/services/agentAuthService';

interface AudioFile {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  agent_id?: string;
  isExclusive: boolean;
}

export default function AgentAudiosPage() {
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAgentData();
    
    // Check if mobile on mount and resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  useEffect(() => {
    if (agentData) {
      loadAudioFiles();
    }
  }, [agentData]);

  const loadAgentData = async () => {
    try {
      const result = await agentAuthService.getCurrentAgent();
      if (result.success && result.data) {
        setAgentData(result.data);
      }
    } catch (error) {
      console.error('Error loading agent data:', error);
      showToast('Erro ao carregar dados do agente', 'error');
    }
  };

  const loadAudioFiles = async () => {
    if (!agentData?.id || !agentData?.user_id) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('agent_token');
      if (!token) {
        showToast('Token de autenticação não encontrado', 'error');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/audios/agent/${agentData.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAudioFiles(data.data || []);
        } else {
          showToast(data.message || 'Erro ao carregar áudios', 'error');
        }
      } else {
        showToast('Erro ao carregar áudios', 'error');
      }
    } catch (error) {
      console.error('Error loading audio files:', error);
      showToast('Erro ao carregar áudios', 'error');
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, name?: string) => {
    if (!file || !agentData?.id) return;

    // Validate file type
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Formato de arquivo não suportado. Use WAV, MP3 ou OGG.', 'error');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('Arquivo muito grande. Máximo 10MB.', 'error');
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem('agent_token');
      if (!token) {
        showToast('Token de autenticação não encontrado', 'error');
        return;
      }

      const formData = new FormData();
      formData.append('audio', file);
      formData.append('name', name && name.trim() ? name.trim() : file.name);
      formData.append('agent_id', agentData.id);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/audios/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showToast('Áudio enviado com sucesso!', 'success');
          loadAudioFiles(); // Reload the list
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } else {
          showToast(data.message || 'Erro ao enviar áudio', 'error');
        }
      } else {
        showToast('Erro ao enviar áudio', 'error');
      }
    } catch (error) {
      console.error('Error uploading audio:', error);
      showToast('Erro ao enviar áudio', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handlePlay = async (audioFile: AudioFile) => {
    if (playingId === audioFile.id) {
      // Pause current audio
      if (currentAudio) {
        currentAudio.pause();
        setPlayingId(null);
        setCurrentAudio(null);
      }
    } else {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
      }

      try {
        const token = localStorage.getItem('agent_token');
        if (!token) {
          showToast('Token de autenticação não encontrado', 'error');
          return;
        }

        // Create audio URL with token as query parameter for authentication
        const audioUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/audios/play/${audioFile.id}?token=${encodeURIComponent(token)}`;
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setPlayingId(null);
          setCurrentAudio(null);
        };

        audio.onerror = (e) => {
          console.error('Audio error:', e);
          setPlayingId(null);
          setCurrentAudio(null);
          showToast('Erro ao carregar áudio', 'error');
        };

        await audio.play();
        setPlayingId(audioFile.id);
        setCurrentAudio(audio);
      } catch (error) {
        console.error('Error playing audio:', error);
        showToast('Erro ao reproduzir áudio', 'error');
      }
    }
  };

  const handleDelete = async (audioId: string) => {
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) {
        showToast('Token de autenticação não encontrado', 'error');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/audios/${audioId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showToast('Áudio excluído com sucesso!', 'success');
          setAudioFiles(prev => prev.filter(audio => audio.id !== audioId));
          
          // Stop playing if this audio was playing
          if (playingId === audioId && currentAudio) {
            currentAudio.pause();
            setPlayingId(null);
            setCurrentAudio(null);
          }
        } else {
          showToast(data.message || 'Erro ao excluir áudio', 'error');
        }
      } else {
        showToast('Erro ao excluir áudio', 'error');
      }
    } catch (error) {
      console.error('Error deleting audio:', error);
      showToast('Erro ao excluir áudio', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
    <AgentLayout>
      <div style={{
        padding: '24px',
        minHeight: '100vh'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1e293b',
              margin: 0,
              lineHeight: '1.2'
            }}>
              Áudios
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#64748b',
              margin: '4px 0 0 0'
            }}>
              Gerencie seus arquivos de áudio
            </p>
          </div>

          {/* Upload Button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => {
                setSelectedFile(null);
                setUploadName('');
                setUploadError(null);
                setShowUploadModal(true);
              }}
              disabled={uploading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: uploading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (!uploading) {
                  e.currentTarget.style.background = '#2563eb';
                }
              }}
              onMouseOut={(e) => {
                if (!uploading) {
                  e.currentTarget.style.background = '#3b82f6';
                }
              }}
            >
              <Upload size={18} />
              {uploading ? 'Enviando...' : 'Upload Áudio'}
            </button>
          </div>
        </div>

        {/* Audio Files Table */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          {loading ? (
            <div style={{
              padding: '48px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              Carregando áudios...
            </div>
          ) : audioFiles.length === 0 ? (
            <div style={{
              padding: '48px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <Music size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <p style={{ fontSize: '16px', margin: 0 }}>
                Nenhum áudio encontrado. Faça o upload do seu primeiro áudio!
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div style={{ display: !isMobile ? 'block' : 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{
                        padding: '16px 24px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Áudio
                      </th>
                      <th style={{
                        padding: '16px 24px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Data Criação
                      </th>
                      <th style={{
                        padding: '16px 24px',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Exclusivo?
                      </th>
                      <th style={{
                        padding: '16px 24px',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {audioFiles.map((audio, index) => (
                      <tr key={audio.id} style={{
                        borderBottom: index < audioFiles.length - 1 ? '1px solid #e2e8f0' : 'none'
                      }}>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Music size={20} color="#667eea" />
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#1e293b'
                            }}>
                              {audio.name}
                            </span>
                            {audio.isExclusive && (
                              <Star size={16} color="#fbbf24" fill="#fbbf24" />
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={16} color="#64748b" />
                            <span style={{
                              fontSize: '14px',
                              color: '#64748b'
                            }}>
                              {formatDate(audio.created_at)}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: audio.isExclusive ? '#dcfce7' : '#f1f5f9',
                            color: audio.isExclusive ? '#166534' : '#475569'
                          }}>
                            {audio.isExclusive ? 'Sim' : 'Não'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}>
                            <button
                              onClick={() => handlePlay(audio)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '36px',
                                height: '36px',
                                background: playingId === audio.id ? '#ef4444' : '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              title={playingId === audio.id ? 'Pausar' : 'Reproduzir'}
                            >
                              {playingId === audio.id ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(audio.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '36px',
                                height: '36px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div style={{ display: isMobile ? 'block' : 'none', padding: '16px' }}>
                {audioFiles.map((audio) => (
                  <div key={audio.id} style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Music size={18} color="#667eea" />
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1e293b'
                        }}>
                          {audio.name}
                        </span>
                        {audio.isExclusive && (
                          <Star size={14} color="#fbbf24" fill="#fbbf24" />
                        )}
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{
                        fontSize: '12px',
                        color: '#64748b',
                        margin: '0 0 4px 0'
                      }}>
                        Data: {formatDate(audio.created_at)}
                      </p>
                      <p style={{
                        fontSize: '12px',
                        color: '#64748b',
                        margin: 0
                      }}>
                        Exclusivo: {audio.isExclusive ? 'Sim' : 'Não'}
                      </p>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <button
                        onClick={() => handlePlay(audio)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '8px 16px',
                          background: playingId === audio.id ? '#ef4444' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {playingId === audio.id ? <Pause size={14} /> : <Play size={14} />}
                        {playingId === audio.id ? 'Pausar' : 'Reproduzir'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(audio.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '8px 12px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <AlertCircle size={24} color="#ef4444" />
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#1e293b',
                  margin: 0
                }}>
                  Confirmar Exclusão
                </h3>
              </div>
              
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                marginBottom: '24px',
                lineHeight: '1.5'
              }}>
                Tem certeza que deseja excluir este áudio? Esta ação não pode ser desfeita.
              </p>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{
                    padding: '8px 16px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  style={{
                    padding: '8px 16px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Novo Áudio</h3>
                <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Arquivo</label>
                <div style={{
                  border: '1px dashed #cbd5e1',
                  borderRadius: 8,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Upload size={16} color="#64748b" />
                    <span style={{ fontSize: 14, color: selectedFile ? '#0f172a' : '#64748b' }}>
                      {selectedFile ? selectedFile.name : 'Selecione um arquivo de áudio (WAV, MP3, OGG)'}
                    </span>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '8px 12px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Escolher
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setSelectedFile(f);
                      if (f) {
                        setUploadName(f.name.replace(/\.[^/.]+$/, ''));
                        setUploadError(null);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                </div>

                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Nome</label>
                <input
                  type="text"
                  placeholder="Digite um nome para o áudio"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 14,
                    outline: 'none'
                  }}
                />

                {uploadError && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#ef4444',
                    fontSize: 12
                  }}>
                    <AlertCircle size={14} />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    style={{
                      padding: '8px 12px',
                      background: '#f1f5f9',
                      color: '#64748b',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      if (!selectedFile) {
                        setUploadError('Selecione um arquivo de áudio');
                        return;
                      }
                      setUploadError(null);
                      await uploadFile(selectedFile, uploadName);
                      setShowUploadModal(false);
                      setSelectedFile(null);
                      setUploadName('');
                    }}
                    disabled={uploading}
                    style={{
                      padding: '8px 16px',
                      background: uploading ? '#9ca3af' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: uploading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {uploading ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            background: toast.type === 'success' ? '#10b981' : '#ef4444',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            zIndex: 1000,
            maxWidth: '400px'
          }}>
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span style={{ fontSize: '14px', fontWeight: '500' }}>
              {toast.message}
            </span>
            <button
              onClick={() => setToast(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '2px',
                marginLeft: '8px'
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </AgentLayout>
  );
}
