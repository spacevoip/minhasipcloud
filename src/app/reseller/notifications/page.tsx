'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, Plus, Edit, Trash2, X } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import notificationsService, { AudienceType, NotificationInput, NotificationItem } from '@/lib/notificationsService';

function useToast() {
  return {
    success: (title: string, msg?: string) => console.log('✅', title, msg || ''),
    error: (title: string, msg?: string) => console.error('❌', title, msg || ''),
    info: (title: string, msg?: string) => console.log('ℹ️', title, msg || ''),
  };
}

export default function ResellerNotificationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<NotificationItem | null>(null);
  const [form, setForm] = useState<NotificationInput>({
    title: '',
    message: '',
    status: 'active',
    audience_type: 'reseller_users',
    target_reseller_id: null,
    expires_at: null,
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await notificationsService.list({ limit: 50 });
      setItems(res.data);
    } catch (e: any) {
      toast.error('Erro ao carregar notificações', e?.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', message: '', status: 'active', audience_type: 'reseller_users', target_reseller_id: null, expires_at: null });
    setShowModal(true);
  };
  const openEdit = (n: NotificationItem) => {
    setEditing(n);
    setForm({
      title: n.title,
      message: n.message,
      status: n.status,
      audience_type: 'reseller_users',
      target_reseller_id: null,
      expires_at: (n as any).expires_at || null,
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Título é obrigatório'); return; }
    if (!form.message.trim()) { toast.error('Mensagem é obrigatória'); return; }

    try {
      const payload: NotificationInput = {
        ...form,
        audience_type: 'reseller_users',
        target_reseller_id: form.target_reseller_id ?? null,
      };
      if (editing) {
        const res = await notificationsService.update(editing.id, payload);
        setItems(prev => prev.map(i => i.id === editing.id ? res.data : i));
        toast.success('Notificação atualizada');
      } else {
        const res = await notificationsService.create(payload);
        setItems(prev => [res.data, ...prev]);
        toast.success('Notificação criada');
      }
      closeModal();
    } catch (e: any) {
      toast.error('Erro ao salvar', e?.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta notificação?')) return;
    try {
      await notificationsService.remove(id);
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Notificação excluída');
    } catch (e: any) {
      toast.error('Erro ao excluir', e?.message);
    }
  };

  const formatDate = (s?: string | null) => {
    if (!s) return '-';
    try { return new Date(s).toLocaleString('pt-BR'); } catch { return s; }
  };

  return (
    <MainLayout>
      <div style={{ padding: '2rem', minHeight: '100vh', background: '#f8fafc' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>Notificações</h1>
            <p style={{ color: '#64748b' }}>Envie notificações para os seus usuários</p>
          </div>
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.75rem 1.25rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '.5rem', cursor: 'pointer' }}>
            <Plus style={{ width: 16, height: 16 }} /> Nova Notificação
          </button>
        </div>

        {/* List */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '.75rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Título</th>
                <th style={{ textAlign: 'left', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Mensagem</th>
                <th style={{ textAlign: 'left', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Criada</th>
                <th style={{ textAlign: 'left', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Expira</th>
                <th style={{ textAlign: 'right', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', color: '#1e293b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    <Bell style={{ width: 16, height: 16, color: '#10b981' }} /> {n.title}
                  </td>
                  <td style={{ padding: '1rem', color: '#334155', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={n.message}>
                    {n.message}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ padding: '.25rem .75rem', borderRadius: 999, background: n.status === 'active' ? '#dcfce7' : n.status === 'draft' ? '#e0e7ff' : '#fde68a', color: n.status === 'active' ? '#166534' : n.status === 'draft' ? '#3730a3' : '#92400e', fontSize: 12, fontWeight: 600 }}>
                      {n.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{formatDate((n as any).created_at)}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{formatDate((n as any).expires_at)}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => openEdit(n)} title="Editar" style={{ padding: '.5rem', borderRadius: '.5rem', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
                        <Edit style={{ width: 16, height: 16 }} />
                      </button>
                      <button onClick={() => handleDelete(n.id)} title="Excluir" style={{ padding: '.5rem', borderRadius: '.5rem', border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}>
                        <Trash2 style={{ width: 16, height: 16 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Nenhuma notificação encontrada</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Criar/Editar */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
               onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <div style={{ background: 'rgba(255,255,255,.98)', backdropFilter: 'blur(20px)', borderRadius: '1rem', border: '1px solid rgba(0,0,0,.06)', boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)', width: '100%', maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1f2937' }}>{editing ? 'Editar Notificação' : 'Nova Notificação'}</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', padding: '.25rem', borderRadius: 8, cursor: 'pointer' }}>
                  <X style={{ width: 20, height: 20, color: '#6b7280' }} />
                </button>
              </div>
              <div style={{ padding: '1rem 1.5rem', display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Título *</label>
                  <input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Manutenção do sistema" style={{ width: '100%', padding: '.75rem 1rem', border: '1px solid #d1d5db', borderRadius: 8, background: 'rgba(255,255,255,.85)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Mensagem *</label>
                  <textarea value={form.message} onChange={(e) => setForm(p => ({ ...p, message: e.target.value }))} rows={5} placeholder="Descreva a notificação..." style={{ width: '100%', padding: '.75rem 1rem', border: '1px solid #d1d5db', borderRadius: 8, background: 'rgba(255,255,255,.85)', resize: 'vertical' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Status</label>
                    <select value={form.status} onChange={(e) => setForm(p => ({ ...p, status: e.target.value as any }))} style={{ width: '100%', padding: '.6rem .9rem', border: '1px solid #d1d5db', borderRadius: 8 }}>
                      <option value="draft">Rascunho</option>
                      <option value="active">Ativa</option>
                      <option value="archived">Arquivada</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Expira em</label>
                    <input type="datetime-local" value={form.expires_at ? new Date(form.expires_at).toISOString().slice(0,16) : ''} onChange={(e) => setForm(p => ({ ...p, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} style={{ width: '100%', padding: '.6rem .9rem', border: '1px solid #d1d5db', borderRadius: 8 }} />
                  </div>
                </div>
                {/* Audiência fixada para revenda */}
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Audiência: <b>Usuários da sua Revenda</b></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem', paddingTop: '.5rem' }}>
                  <button onClick={closeModal} style={{ padding: '.75rem 1.25rem', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={handleSubmit} style={{ padding: '.75rem 1.25rem', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', cursor: 'pointer' }}>{editing ? 'Salvar' : 'Criar'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
