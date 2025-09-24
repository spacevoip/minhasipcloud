'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Filter, Eye, Edit, Trash2, DollarSign } from 'lucide-react';
import { usersService } from '@/services/usersService';
import { plansService } from '@/services/plansService';
import type { AdminUser, Plan } from '@/types';

const ITEMS_PER_PAGE = 12;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Carregar dados
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersData, plansData] = await Promise.all([
        usersService.getAllUsers(),
        plansService.getAllPlans()
      ]);
      setUsers(usersData.users || usersData);
      setPlans(plansData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setToast({ message: 'Erro ao carregar dados', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrar usuários
  const filteredUsers = useMemo(() => {
    if (!users.length) return [];
    
    return users.filter(user => {
      const matchesSearch = !searchTerm || 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.company?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [users, searchTerm]);

  // Paginação
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

  // Handlers
  const handleView = useCallback((user: AdminUser) => {
    console.log('Visualizar usuário:', user.name);
  }, []);

  const handleEdit = useCallback((user: AdminUser) => {
    console.log('Editar usuário:', user.name);
  }, []);

  const handleDelete = useCallback((user: AdminUser) => {
    console.log('Excluir usuário:', user.name);
  }, []);

  const handleAddCredits = useCallback((user: AdminUser) => {
    console.log('Adicionar créditos para:', user.name);
  }, []);

  // Estatísticas
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    inactive: users.filter(u => u.status === 'inactive').length,
    suspended: users.filter(u => u.status === 'suspended').length,
    totalCredits: users.reduce((sum, u) => sum + u.credits, 0)
  }), [users]);

  // Fechar toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
            Gerenciamento de Usuários
          </h1>
          <p style={{ color: '#64748b' }}>Carregando usuários...</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ height: '200px', backgroundColor: '#f1f5f9', borderRadius: '0.5rem', animation: 'pulse 2s infinite' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '100%' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
            color: 'white',
            fontWeight: '600',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '2rem', 
              fontWeight: '700', 
              color: '#1e293b', 
              marginBottom: '0.5rem' 
            }}>
              Gerenciamento de Usuários
            </h1>
            <p style={{ color: '#64748b' }}>
              {filteredUsers.length} usuários encontrados
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '600'
              }}
            >
              <Plus style={{ width: '1rem', height: '1rem' }} />
              Novo Usuário
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem',
          marginTop: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b' }}>
              {stats.total}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Total de Usuários</div>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981' }}>
              {stats.active}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Usuários Ativos</div>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b' }}>
              {stats.inactive}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Usuários Inativos</div>
          </div>
          
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981' }}>
              R$ {stats.totalCredits.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Total em Créditos</div>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search 
            style={{ 
              position: 'absolute', 
              left: '0.75rem', 
              top: '50%', 
              transform: 'translateY(-50%)',
              width: '1rem', 
              height: '1rem', 
              color: '#9ca3af' 
            }} 
          />
          <input
            type="text"
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 0.75rem 0.75rem 2.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '0.875rem'
            }}
          />
        </div>
      </div>

      {/* Lista de Usuários */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {paginatedUsers.map((user) => (
          <div
            key={user.id}
            style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              transition: 'all 0.2s ease'
            }}
          >
            {/* Header do Card */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: '1rem' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '1rem'
                  }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '1.125rem', 
                    fontWeight: '600', 
                    color: '#1e293b' 
                  }}>
                    {user.name}
                  </h3>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '0.875rem', 
                    color: '#64748b' 
                  }}>
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '1rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  backgroundColor: user.status === 'active' ? '#16a34a15' : '#f59e0b15',
                  color: user.status === 'active' ? '#16a34a' : '#f59e0b',
                  border: `1px solid ${user.status === 'active' ? '#16a34a30' : '#f59e0b30'}`
                }}
              >
                {user.status === 'active' ? 'Ativo' : 'Inativo'}
              </div>
            </div>

            {/* Informações */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  Empresa
                </div>
                <div style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: '500' }}>
                  {user.company || 'Não informado'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  Créditos
                </div>
                <div style={{ fontSize: '0.875rem', color: '#16a34a', fontWeight: '600' }}>
                  R$ {user.credits.toFixed(2)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  Plano
                </div>
                <div style={{ fontSize: '0.875rem', color: '#3b82f6', fontWeight: '500' }}>
                  {user.planName || 'Sem plano'}
                </div>
              </div>
            </div>

            {/* Ações */}
            <div style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              flexWrap: 'wrap',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => handleView(user)}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #e0f2fe',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Eye style={{ width: '1rem', height: '1rem', color: '#0369a1' }} />
              </button>

              <button
                onClick={() => handleEdit(user)}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #dcfce7',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Edit style={{ width: '1rem', height: '1rem', color: '#16a34a' }} />
              </button>

              <button
                onClick={() => handleAddCredits(user)}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#fefce8',
                  border: '1px solid #fef3c7',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <DollarSign style={{ width: '1rem', height: '1rem', color: '#ca8a04' }} />
              </button>

              <button
                onClick={() => handleDelete(user)}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Trash2 style={{ width: '1rem', height: '1rem', color: '#dc2626' }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '0.5rem',
          marginTop: '2rem'
        }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
              color: currentPage === 1 ? '#9ca3af' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Anterior
          </button>
          
          <span style={{ 
            padding: '0.5rem 1rem', 
            fontSize: '0.875rem', 
            color: '#64748b' 
          }}>
            Página {currentPage} de {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
              color: currentPage === totalPages ? '#9ca3af' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Próxima
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredUsers.length === 0 && !loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem', 
          color: '#64748b' 
        }}>
          <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Nenhum usuário encontrado
          </div>
          <div>Tente ajustar os filtros de busca</div>
        </div>
      )}
    </div>
  );
}
