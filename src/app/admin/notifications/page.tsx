'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Bell, Plus, Edit, Trash2, X, ListChecks, Search, Filter } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { authService } from '@/lib/auth';
import notificationsService, { AudienceType, NotificationInput, NotificationItem } from '@/lib/notificationsService';

function useToast() {
  return {
    success: (title: string, msg?: string) => console.log('✅', title, msg || ''),
    // Evita spam de stack no console
    error: (title: string, msg?: string) => console.log('❌', title, msg || ''),
    info: (title: string, msg?: string) => console.log('ℹ️', title, msg || ''),
  };
}

export default function AdminNotificationsPage() {
  // Memoize toast instance so it doesn't change between renders
  const toast = useMemo(useToast, []);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<NotificationItem | null>(null);
  const [form, setForm] = useState<NotificationInput>({
    title: '',
    message: '',
    status: 'active',
    audience_type: 'all',
    target_reseller_id: null,
    expires_at: null,
  });
  const [showRecipients, setShowRecipients] = useState<{ id: string; title: string } | null>(null);
  const isAdmin = authService.isAdmin();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Helpers para converter expires_at (ISO) <-> inputs de data/hora locais
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const toDateInputString = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const toTimeInputString = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const todayDateStr = toDateInputString(new Date());

  const expiresDateStr = useMemo(() => {
    if (!form.expires_at) return '';
    const d = new Date(form.expires_at);
    if (isNaN(d.getTime())) return '';
    return toDateInputString(d);
  }, [form.expires_at]);

  const expiresTimeStr = useMemo(() => {
    if (!form.expires_at) return '';
    const d = new Date(form.expires_at);
    if (isNaN(d.getTime())) return '';
    return toTimeInputString(d);
  }, [form.expires_at]);

  const combineToISO = (dateStr: string, timeStr: string) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
    let hh = 0, mm = 0;
    if (timeStr) {
      const [hStr, mStr] = timeStr.split(':');
      hh = parseInt(hStr, 10) || 0;
      mm = parseInt(mStr, 10) || 0;
    }
    const local = new Date(y, (m || 1) - 1, d || 1, hh, mm, 0);
    if (isNaN(local.getTime())) return null;
    return local.toISOString();
  };

  // Filtros
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<NotificationItem['status'] | ''>('');
  const [audienceFilter, setAudienceFilter] = useState<NotificationItem['audience_type'] | ''>('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await notificationsService.list({
        limit: 50,
        audience_type: audienceFilter || undefined,
        status: statusFilter || undefined,
        ...(q ? { search: q } as any : {}),
      } as any);
      setItems(res.data);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar notificações');
      toast.error('Erro ao carregar notificações', e?.message);
    } finally {
      setLoading(false);
    }
  }, [toast, audienceFilter, statusFilter, q]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', message: '', status: 'active', audience_type: isAdmin ? 'all' : 'reseller_users', target_reseller_id: null, expires_at: null });
    setShowModal(true);
  };
  const openEdit = (n: NotificationItem) => {
    setEditing(n);
    setForm({
      title: n.title,
      message: n.message,
      status: n.status,
      audience_type: n.audience_type as AudienceType,
      target_reseller_id: (n as any).target_reseller_id || null,
      expires_at: (n as any).expires_at || null,
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Título é obrigatório'); return; }
    if (!form.message.trim()) { toast.error('Mensagem é obrigatória'); return; }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      if (editing) {
        const res = await notificationsService.update(editing.id, form);
        setItems(prev => prev.map(i => i.id === editing.id ? res.data : i));
        toast.success('Notificação atualizada');
      } else {
        const res = await notificationsService.create(form);
        setItems(prev => [res.data, ...prev]);
        toast.success('Notificação criada');
      }
      closeModal();
    } catch (e: any) {
      toast.error('Erro ao salvar', e?.message);
      setSubmitError(e?.message || 'Erro ao salvar');
    }
    finally {
      setIsSubmitting(false);
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
            <p style={{ color: '#64748b' }}>Envie e gerencie notificações para usuários</p>
          </div>
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.75rem 1.25rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '.5rem', cursor: 'pointer' }}>
            <Plus style={{ width: 16, height: 16 }} /> Nova Notificação
          </button>
        </div>

        {/* Barra de filtros */}
        <div className="filters">
          <div className="searchWrap">
            <Search className="searchIcon" />
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="Buscar por título ou mensagem"
              className="searchInput"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e)=>setStatusFilter((e.target.value||'') as any)}
            className="filterSelect"
          >
            <option value="">Status (todos)</option>
            <option value="draft">Rascunho</option>
            <option value="active">Ativa</option>
            <option value="archived">Arquivada</option>
          </select>
          <select
            value={audienceFilter}
            onChange={(e)=>setAudienceFilter((e.target.value||'') as any)}
            className="filterSelect"
          >
            <option value="">Audiência (todas)</option>
            <option value="all">Todos</option>
            <option value="users">Somente usuários</option>
            <option value="resellers">Somente revendas</option>
            <option value="reseller_users">Usuários de uma revenda</option>
          </select>
        </div>

        {/* Erro */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.75rem 1rem', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', marginBottom: '1rem' }}>
            <Bell style={{ width: 16, height: 16, color: '#ef4444' }} />
            <div>
              <div style={{ fontWeight: 600 }}>Erro ao carregar notificações</div>
              <div style={{ fontSize: 12, opacity: .9 }}>{error}</div>
            </div>
          </div>
        )}

        {/* List */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '.75rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Título</th>
                <th style={{ textAlign: 'left', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Mensagem</th>
                <th style={{ textAlign: 'left', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Audiência</th>
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
                    <Bell style={{ width: 16, height: 16, color: '#f59e0b' }} /> {n.title}
                  </td>
                  <td style={{ padding: '1rem', color: '#334155', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={n.message}>
                    {n.message}
                  </td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>
                    {n.audience_type === 'all' && 'Todos'}
                    {n.audience_type === 'users' && 'Somente usuários'}
                    {n.audience_type === 'resellers' && 'Somente revendas'}
                    {n.audience_type === 'reseller_users' && 'Usuários da Revenda'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ padding: '.25rem .75rem', borderRadius: 999, background: n.status === 'active' ? '#dcfce7' : n.status === 'draft' ? '#e0e7ff' : '#fde68a', color: n.status === 'active' ? '#166534' : n.status === 'draft' ? '#3730a3' : '#92400e', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                      {n.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{formatDate((n as any).created_at)}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{formatDate((n as any).expires_at)}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => setShowRecipients({ id: n.id, title: n.title })} title="Destinatários" style={{ padding: '.5rem', borderRadius: '.5rem', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
                        <ListChecks style={{ width: 16, height: 16, color: '#2563eb' }} />
                      </button>
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
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Nenhuma notificação encontrada</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Carregando...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Criar/Editar */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
               onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <div style={{ background: 'rgba(255,255,255,.98)', backdropFilter: 'blur(20px)', borderRadius: '1rem', border: '1px solid rgba(0,0,0,.06)', boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)', width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', margin: '0 auto' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1f2937' }}>{editing ? 'Editar Notificação' : 'Nova Notificação'}</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', padding: '.25rem', borderRadius: 8, cursor: 'pointer' }}>
                  <X style={{ width: 20, height: 20, color: '#6b7280' }} />
                </button>
              </div>
              <div style={{ padding: '1rem 1.5rem', display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Título *</label>
                  <input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Manutenção do sistema" style={{ width: '100%', padding: '.75rem 1rem', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Mensagem *</label>
                  <textarea value={form.message} onChange={(e) => setForm(p => ({ ...p, message: e.target.value }))} rows={5} placeholder="Descreva a notificação..." style={{ width: '100%', padding: '.75rem 1rem', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Status</label>
                    <select value={form.status} onChange={(e) => setForm(p => ({ ...p, status: e.target.value as any }))} style={{ width: '100%', padding: '.6rem .9rem', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', boxSizing: 'border-box' }}>
                      <option value="draft">Rascunho</option>
                      <option value="active">Ativa</option>
                      <option value="archived">Arquivada</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Expira em</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '.5rem' }}>
                      <input
                        type="date"
                        value={expiresDateStr}
                        min={todayDateStr}
                        onChange={(e) => {
                          const newISO = combineToISO(e.target.value, expiresTimeStr);
                          setForm((p) => ({ ...p, expires_at: newISO }));
                        }}
                        style={{ width: '100%', padding: '.6rem .9rem', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', boxSizing: 'border-box' }}
                      />
                      <input
                        type="time"
                        value={expiresTimeStr}
                        onChange={(e) => {
                          const newISO = combineToISO(expiresDateStr, e.target.value);
                          setForm((p) => ({ ...p, expires_at: newISO }));
                        }}
                        style={{ width: '100%', padding: '.6rem .9rem', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', boxSizing: 'border-box' }}
                      />
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, expires_at: null }))}
                        title="Limpar expiração"
                        style={{ padding: '.6rem .9rem', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Limpar
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Escolha a data no calendário e o horário; deixe em branco para não expirar.</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Audiência</label>
                    <select value={form.audience_type} onChange={(e) => setForm(p => ({ ...p, audience_type: e.target.value as AudienceType }))} style={{ width: '100%', padding: '.6rem .9rem', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', boxSizing: 'border-box' }}>
                      <option value="all">Todos</option>
                      <option value="users">Somente usuários</option>
                      <option value="resellers">Somente revendas</option>
                      <option value="reseller_users">Usuários da Revenda</option>
                    </select>
                  </div>
                  {form.audience_type === 'reseller_users' && (
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>ID da Revenda</label>
                      <input value={form.target_reseller_id || ''} onChange={(e) => setForm(p => ({ ...p, target_reseller_id: e.target.value || null }))} placeholder="uuid da revenda" style={{ width: '100%', padding: '.6rem .9rem', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', boxSizing: 'border-box' }} />
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Informe o UUID da revenda alvo para enviar apenas aos usuários dessa revenda.</div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem', paddingTop: '.5rem', flexWrap: 'wrap' }}>
                  <button onClick={closeModal} style={{ padding: '.75rem 1.25rem', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={handleSubmit} disabled={isSubmitting} style={{ padding: '.75rem 1.25rem', borderRadius: 10, border: 'none', background: isSubmitting ? '#9ca3af' : 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.8 : 1 }}>
                    {isSubmitting ? 'Salvando...' : (editing ? 'Salvar' : 'Criar')}
                  </button>
                </div>
                {submitError && (
                  <div style={{ marginTop: '.5rem', color: '#b91c1c', fontSize: 12 }}>
                    {submitError}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Destinatários */}
        {showRecipients && (
          <RecipientsModal id={showRecipients.id} title={showRecipients.title} onClose={() => setShowRecipients(null)} />
        )}
      </div>
      <style jsx>{`
        .filters {
          display: grid;
          grid-template-columns: 1fr 200px 240px;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .searchWrap {
          position: relative;
          width: 100%;
        }
        .searchIcon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: #64748b;
        }
        .searchInput {
          width: 100%;
          padding: .6rem .9rem .6rem 2rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
          box-sizing: border-box;
        }
        .filterSelect {
          width: 100%;
          padding: .6rem .9rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
          box-sizing: border-box;
        }
        @media (max-width: 1024px) {
          .filters {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 640px) {
          .filters {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </MainLayout>
  );
}

function RecipientsModal({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await notificationsService.listRecipients(id);
        setRows(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'rgba(255,255,255,.98)', backdropFilter: 'blur(20px)', borderRadius: '1rem', border: '1px solid rgba(0,0,0,.06)', boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)', width: '100%', maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1f2937' }}>Destinatários — {title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', padding: '.25rem', borderRadius: 8, cursor: 'pointer' }}>
            <X style={{ width: 20, height: 20, color: '#6b7280' }} />
          </button>
        </div>
        <div style={{ padding: '1rem 1.5rem' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '.75rem', borderBottom: '1px solid #e5e7eb' }}>Usuário</th>
                  <th style={{ textAlign: 'left', padding: '.75rem', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '.75rem', borderBottom: '1px solid #e5e7eb' }}>Entregue</th>
                  <th style={{ textAlign: 'left', padding: '.75rem', borderBottom: '1px solid #e5e7eb' }}>Lida</th>
                  <th style={{ textAlign: 'left', padding: '.75rem', borderBottom: '1px solid #e5e7eb' }}>Dispensada</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '.75rem' }}>{r.user_name || r.user_email || r.user_id}</td>
                    <td style={{ padding: '.75rem' }}>
                      <span style={{ padding: '.25rem .6rem', borderRadius: 999, background: r.status === 'read' ? '#dbeafe' : r.status === 'delivered' ? '#dcfce7' : r.status === 'dismissed' ? '#fee2e2' : '#e5e7eb', color: '#111827', fontSize: 12, fontWeight: 600 }}>{r.status}</span>
                    </td>
                    <td style={{ padding: '.75rem' }}>{r.delivered_at ? new Date(r.delivered_at).toLocaleString('pt-BR') : '-'}</td>
                    <td style={{ padding: '.75rem' }}>{r.read_at ? new Date(r.read_at).toLocaleString('pt-BR') : '-'}</td>
                    <td style={{ padding: '.75rem' }}>{r.dismissed_at ? new Date(r.dismissed_at).toLocaleString('pt-BR') : '-'}</td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>Sem destinatários</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
