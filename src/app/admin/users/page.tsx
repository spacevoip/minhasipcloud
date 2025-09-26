'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type React from 'react';
import { Eye, EyeOff, Edit, Trash2, Plus, Search, DollarSign, Users, UserCheck, Building, Phone, Mail, Settings, X, Download, Filter, Shield, User, CreditCard, AlertTriangle, UserCog, MinusCircle, Lock, Unlock, Ban, CheckCircle, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useDebounce } from '@/hooks/useDebounce';
import { ResponsiveCard, useIsMobile } from '@/components/ui/responsive-card';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { DataExport } from '@/components/ui/data-export';
import { AdvancedFilters } from '@/components/ui/advanced-filters';
import { usersServiceWithFallback, normalizePhoneToSave } from '@/services/usersService';
import { plansService } from '@/services/plansService';
import { getStatusColor, getStatusLabel } from '@/lib/statusHelpers';
import { unifiedAuthService } from '@/lib/unifiedAuth';
import { computeDaysRemainingUTC, computeDaysExpiredUTC } from '@/lib/planUtils';
import PlanPill from '@/components/ui/PlanPill';
import RowActionsMenu from '@/components/ui/RowActionsMenu';
import StatusPill from '@/components/ui/StatusPill';
// Removido bcrypt do client: hashing será feito no backend / fallback do service

// Componentes internos (Modais de Ações em Lote)
type BulkDeleteModalProps = {
  isOpen: boolean;
  count: number;
  loading: boolean;
  confirmText: string;
  onChangeConfirmText: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({ isOpen, count, loading, confirmText, onChangeConfirmText, onCancel, onConfirm }) => {
  if (!isOpen) return null;
  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: '1rem' }}
      onClick={onCancel}
    >
      <div
        style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', width: '100%', maxWidth: '500px', padding: '2rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={20} style={{ color: '#dc2626' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1f2937' }}>Confirmar Exclusão em Lote</h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>Esta ação não pode ser desfeita</p>
          </div>
        </div>
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: '1.5', marginBottom: '1rem' }}>
            Você está prestes a excluir <strong>{count}</strong> usuário{count !== 1 ? 's' : ''} permanentemente.
          </p>
          <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <AlertTriangle size={16} style={{ color: '#d97706' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#92400e' }}>Atenção: Exclusão em Cascata</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#92400e', margin: 0, lineHeight: '1.4' }}>
              Todos os ramais/agentes vinculados a estes usuários também serão excluídos permanentemente.
            </p>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>Digite "TRUST" para prosseguir com a exclusão:</p>
          <input
            type="text"
            placeholder="Digite TRUST"
            value={confirmText}
            onChange={(e) => onChangeConfirmText(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', marginTop: '0.5rem', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={loading} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#64748b', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>Cancelar</button>
          <button onClick={onConfirm} disabled={confirmText !== 'TRUST' || loading} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#ef4444', border: 'none', borderRadius: '0.5rem', color: 'white', fontSize: '0.875rem', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>Excluir</button>
        </div>
      </div>
    </div>
  );
};

type SimpleConfirmModalProps = {
  isOpen: boolean;
  count: number;
  loading: boolean;
  title: string;
  description: string;
  accentColor: string;
  Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  onCancel: () => void;
  onConfirm: () => void;
};

const SimpleConfirmModal: React.FC<SimpleConfirmModalProps> = ({ isOpen, count, loading, title, description, accentColor, Icon, onCancel, onConfirm }) => {
  if (!isOpen) return null;
  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: '1rem' }}
      onClick={onCancel}
    >
      <div
        style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: '480px', padding: '2rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: `${accentColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={20} style={{ color: accentColor }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1f2937' }}>{title}</h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
          </div>
        </div>
        <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          Você está prestes a afetar <strong>{count}</strong> usuário{count !== 1 ? 's' : ''}.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={loading} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#64748b', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding: '0.75rem 1.5rem', backgroundColor: accentColor, border: 'none', borderRadius: '0.5rem', color: 'white', fontSize: '0.875rem', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {title.split(' ')[0]}
          </button>
        </div>
      </div>
    </div>
  );
};

interface AdminUser {
  id: string;
  name: string;
  username: string;
  email: string;
  company: string;
  phone: string;
  role: 'user' | 'admin' | 'reseller' | 'collaborator';
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  credits: number;
  planId?: string;
  planName?: string;
  parentResellerId?: string;
  maxConcurrentCalls: number;
  timezone: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  planExpiresAt?: string;
  planActivatedAt?: string;
  planStatus?: boolean;
  daysRemaining?: number;
  // Campos computados para compatibilidade com UI existente
  plan?: string;
  type?: 'client' | 'reseller' | 'admin' | 'collaborator';
  lastLogin?: Date;
}

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [showWithdrawCreditsModal, setShowWithdrawCreditsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showViewUserModal, setShowViewUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showRenewPlanModal, setShowRenewPlanModal] = useState(false);
  const [showLinkPlanModal, setShowLinkPlanModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [isBlockingUser, setIsBlockingUser] = useState(false);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [isBulkBlocking, setIsBulkBlocking] = useState(false);
  const [isBulkUnblocking, setIsBulkUnblocking] = useState(false);
  const [showBulkBlockModal, setShowBulkBlockModal] = useState(false);
  const [showBulkUnblockModal, setShowBulkUnblockModal] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const toast = useToast();
  const isMobile = useIsMobile();
  const [creditsData, setCreditsData] = useState({
    amount: '',
    note: ''
  });
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    email: '',
    company: '',
    phone: '',
    plan: 'Basic',
    status: 'active',
    password: '',
    type: 'cliente'
  });

  // Toggle de visibilidade da senha (New User modal)
  const [showPassword, setShowPassword] = useState(false);
  const toggleShowPassword = () => setShowPassword((v) => !v);

  // Estados para renovar/vincular plano
  const [planData, setPlanData] = useState({
    planId: '',
    validityDays: '30',
    note: ''
  });
  const [showConfirmRenewModal, setShowConfirmRenewModal] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  
  // Função para fechar todos os modais
  const closeAllModals = () => {
    setShowNewUserModal(false);
    setShowAddCreditsModal(false);
    setShowWithdrawCreditsModal(false);
    setShowViewUserModal(false);
    setShowEditUserModal(false);
    setShowRenewPlanModal(false);
    setShowLinkPlanModal(false);
    setShowDeleteModal(false);
    setShowBulkDeleteModal(false);
  };

  // Abrir modal de confirmação para bloqueio em lote
  const handleBulkBlock = () => {
    if (selectedUsers.size === 0) {
      toast.error('Seleção Vazia', 'Selecione pelo menos um usuário para bloquear');
      return;
    }
    setShowBulkBlockModal(true);
  };

  // Confirmar bloqueio em lote (status: suspended)
  const confirmBulkBlock = async () => {
    if (selectedUsers.size === 0) {
      toast.error('Seleção Vazia', 'Selecione pelo menos um usuário para bloquear');
      return;
    }
    try {
      setIsBulkBlocking(true);
      const current = unifiedAuthService.getCurrentUser();
      const selfId = (current && (current as any).role === 'agent') ? (current as any).user_id : (current as any)?.id;
      const ids = Array.from(selectedUsers).filter(id => id !== selfId);
      if (ids.length !== selectedUsers.size) {
        toast.info('Ação Ajustada', 'Sua própria conta foi removida da seleção por segurança');
      }
      if (ids.length === 0) {
        setIsBulkBlocking(false);
        setShowBulkBlockModal(false);
        return;
      }
      const { updatedIds } = await usersServiceWithFallback.bulkUpdateStatus(ids, 'suspended');
      if (updatedIds.length > 0) {
        setUsers(prev => prev.map(u => updatedIds.includes(u.id) ? { ...u, status: 'suspended' } : u));
      }
      setSelectedUsers(new Set());
      toast.success('Usuários bloqueados', `${updatedIds.length} usuário(s) bloqueado(s) com sucesso`);
    } catch (error) {
      // Erro no bloqueio em lote
      toast.error('Erro', 'Falha ao bloquear usuários selecionados');
    } finally {
      setIsBulkBlocking(false);
      setShowBulkBlockModal(false);
      // Recarregar silenciosamente para garantir dados frescos
      await loadUsers(true);
    }
  };

  // Abrir modal de confirmação para desbloqueio em lote
  const handleBulkUnblock = () => {
    if (selectedUsers.size === 0) {
      toast.error('Seleção Vazia', 'Selecione pelo menos um usuário para desbloquear');
      return;
    }
    setShowBulkUnblockModal(true);
  };

  // Confirmar desbloqueio em lote (status: active)
  const confirmBulkUnblock = async () => {
    if (selectedUsers.size === 0) {
      toast.error('Seleção Vazia', 'Selecione pelo menos um usuário para desbloquear');
      return;
    }
    try {
      setIsBulkUnblocking(true);
      const current = unifiedAuthService.getCurrentUser();
      const selfId = (current && (current as any).role === 'agent') ? (current as any).user_id : (current as any)?.id;
      const ids = Array.from(selectedUsers).filter(id => id !== selfId);
      if (ids.length !== selectedUsers.size) {
        toast.info('Ação Ajustada', 'Sua própria conta foi removida da seleção por segurança');
      }
      if (ids.length === 0) {
        setIsBulkUnblocking(false);
        setShowBulkUnblockModal(false);
        return;
      }
      const { updatedIds } = await usersServiceWithFallback.bulkUpdateStatus(ids, 'active');
      if (updatedIds.length > 0) {
        setUsers(prev => prev.map(u => updatedIds.includes(u.id) ? { ...u, status: 'active' } : u));
      }
      setSelectedUsers(new Set());
      toast.success('Usuários desbloqueados', `${updatedIds.length} usuário(s) desbloqueado(s) com sucesso`);
    } catch (error) {
      // Erro no desbloqueio em lote
      toast.error('Erro', 'Falha ao desbloquear usuários selecionados');
    } finally {
      setIsBulkUnblocking(false);
      setShowBulkUnblockModal(false);
      // Recarregar silenciosamente para garantir dados frescos
      await loadUsers(true);
    }
  };


  // Estado para usuários reais da API
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [totalPagesCount, setTotalPagesCount] = useState(0);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Formata telefone BR para exibição: (XX) XXXXX-XXXX
  const formatPhoneBR = useCallback((phone: string): string => {
    if (!phone) return '';
    const digits = (phone || '').replace(/\D/g, '');
    // Remove código do país se presente
    const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
    // Padrões comuns: 11 dígitos (celular) ou 10 dígitos (fixo)
    if (local.length >= 11) {
      const ddd = local.slice(0, 2);
      const part1 = local.slice(2, 7);
      const part2 = local.slice(7, 11);
      return `(${ddd}) ${part1}-${part2}`;
    }
    if (local.length === 10) {
      const ddd = local.slice(0, 2);
      const part1 = local.slice(2, 6);
      const part2 = local.slice(6, 10);
      return `(${ddd}) ${part1}-${part2}`;
    }
    // Fallback: retorna como está se não bater padrões
    return phone;
  }, []);

  // Função memoizada para converter dados do backend para formato da UI
  const convertBackendUser = useCallback((backendUser: any): AdminUser => {
    // Mapear DIRETAMENTE os campos que chegam do banco
    const planActivatedAt = backendUser.planActivatedAt || backendUser.plan_activated_at;
    const planExpiresAt = backendUser.planExpiresAt || backendUser.plan_expires_at;
    const rawDaysRemaining = backendUser.daysRemaining ?? backendUser.days_remaining;
    const parsedDaysRemaining = typeof rawDaysRemaining === 'string'
      ? Number(rawDaysRemaining)
      : rawDaysRemaining;
    const formattedPhone = formatPhoneBR(backendUser.phone || '');

    // Normalização robusta de status (garante 'active' | 'inactive' | 'suspended' | 'pending')
    const rawStatus = (
      backendUser.status ??
      backendUser.user_status ??
      backendUser.state ??
      backendUser.account_status
    );
    let normalizedStatus: 'active' | 'inactive' | 'suspended' | 'pending' = 'active';
    if (typeof rawStatus === 'string') {
      const s = rawStatus.toLowerCase();
      if (['active', 'ativo'].includes(s)) normalizedStatus = 'active';
      else if (['inactive', 'inativo', 'disabled'].includes(s)) normalizedStatus = 'inactive';
      else if (['suspended', 'suspenso', 'blocked', 'bloqueado'].includes(s)) normalizedStatus = 'suspended';
      else if (['pending', 'pendente'].includes(s)) normalizedStatus = 'pending';
      else normalizedStatus = 'active';
    } else if (typeof rawStatus === 'boolean') {
      normalizedStatus = rawStatus ? 'active' : 'inactive';
    } else if (typeof rawStatus === 'number') {
      normalizedStatus = rawStatus === 1 ? 'active' : rawStatus === 2 ? 'suspended' : 'inactive';
    }
    
    return {
      ...backendUser,
      status: normalizedStatus,
      phone: formattedPhone,
      // Campos computados para compatibilidade
      type: backendUser.role === 'user' ? 'client' : backendUser.role,
      plan: backendUser.planName || 'Sem Plano', // Usar nome real do plano
      planId: backendUser.planId || backendUser.plan_id, // Garantir mapeamento correto do planId
      
      // MAPEAMENTO DIRETO: Usar os campos reais do banco
      planActivatedAt: planActivatedAt,
      planExpiresAt: planExpiresAt,
      planStatus: backendUser.planStatus || backendUser.plan_status,
      daysRemaining: (typeof parsedDaysRemaining === 'number' && isFinite(parsedDaysRemaining) && parsedDaysRemaining >= 0)
        ? parsedDaysRemaining
        : undefined,
      
      lastLogin: backendUser.lastLoginAt ? new Date(backendUser.lastLoginAt) : undefined
    };
  }, [formatPhoneBR]);

  // Função memoizada para carregar usuários reais da API (apenas na inicialização)
  const loadUsers = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setIsLoadingUsers(true);
      }
      
      // Carregar todos os usuários sem filtros para permitir filtro local
      const filters = {
        page: 1,
        limit: 1000 // Carregar todos os usuários de uma vez
      };
      
      const response = await usersServiceWithFallback.getAllUsers(filters);
      
      if (response && response.users) {
        const convertedUsers = response.users.map(convertBackendUser);
        
        // Atualização da interface com dados reais
        setUsers(convertedUsers);
        setTotalUsersCount(response.pagination?.total || convertedUsers.length);
        setTotalPagesCount(response.pagination?.totalPages || 1);
        
        if (!silent) {
          // carregado com sucesso (silencioso)
        }
      } else {
        setUsers([]);
        setTotalUsersCount(0);
        setTotalPagesCount(0);
      }
    } catch (error) {
      console.error(' Erro ao carregar usuários via API:', error);
      if (!silent) {
        toast.error('Erro', 'Erro ao carregar usuários da API. Verifique a conexão.');
      }
      // Em caso de erro, manter estado vazio em vez de fallback
      setUsers([]);
      setTotalUsersCount(0);
      setTotalPagesCount(0);
    } finally {
      if (!silent) {
        setIsLoadingUsers(false);
      }
    }
  }, [toast, convertBackendUser]);

  // Carregar usuários reais da API apenas na inicialização
  useEffect(() => {
    loadUsers();
    loadAvailablePlans();
  }, [loadUsers]);

  // Não recarregar mais quando filtros mudarem - usar filtro local

  // Função para carregar planos disponíveis
  const loadAvailablePlans = useCallback(async () => {
    try {
      const plans = await plansService.getAllPlans();
      setAvailablePlans(plans);
    } catch (error) {
      console.error(' Erro ao carregar planos:', error);
      // SEM FALLBACK MOCK - apenas planos reais
      setAvailablePlans([]);
      toast.error('Erro', 'Não foi possível carregar os planos. Verifique a conexão.');
    }
  }, [toast]);

  // Enriquecer usuários com nome do plano baseado nos planos disponíveis (seguro contra loop)
  useEffect(() => {
    if (!availablePlans.length || !users.length) return;

    // Verificar se há usuários sem planName mas com planId
    const needsUpdate = users.some(u => (u.planId || u.planId === '') && !u.planName);
    if (!needsUpdate) return;

    const planMap = new Map(availablePlans.map(p => [p.id, p.name]));
    const enriched = users.map(u => {
      if (!u.planName) {
        const name = u.planId ? planMap.get(u.planId) : undefined;
        if (name) {
          return { ...u, planName: name, plan: name };
        }
      }
      return u;
    });

    // Só atualizar se houve mudança real
    const changed = enriched.some((u, i) => u !== users[i]);
    if (changed) setUsers(enriched);
  }, [availablePlans, users]);

  // Filtrar usuários memoizado para melhor performance - agora com filtro local inteligente
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = !searchTerm || 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [users, searchTerm, statusFilter]);
  
  // Paginação com 10 itens por página
  const {
    currentPage,
    totalPages,
    currentData: paginatedUsers,
    totalItems,
    itemsPerPage,
    goToPage
  } = usePagination(filteredUsers, 10);

  // Campos de filtros avançados baseados em dados reais
  const filterFields = [
    {
      key: 'plan',
      label: 'Plano',
      type: 'multiselect' as const,
      options: [
        // Gerar opções dinamicamente baseado nos planos reais dos usuários
        ...Array.from(new Set(users.map(u => (u.planName || u.plan || 'Sem Plano')))).map(plan => ({
          value: plan,
          label: plan,
          count: users.filter(u => ((u.planName || u.plan || 'Sem Plano') === plan)).length
        }))
      ]
    },
    {
      key: 'type',
      label: 'Tipo de Usuário',
      type: 'multiselect' as const,
      options: [
        // Gerar opções dinamicamente baseado nos tipos reais dos usuários
        ...Array.from(new Set(users.map(u => u.type || u.role))).map(type => {
          const label = type === 'client' ? 'Cliente' : 
                       type === 'reseller' ? 'Revenda' : 
                       type === 'admin' ? 'Administrador' : 
                       type === 'collaborator' ? 'Colaborador' : 
                       type === 'user' ? 'Cliente' : type;
          return {
            value: type,
            label: label,
            count: users.filter(u => (u.type || u.role) === type).length
          };
        })
      ]
    },
    {
      key: 'credits',
      label: 'Faixa de Créditos',
      type: 'number' as const,
      placeholder: 'Valor mínimo',
      min: 0
    },
    {
      key: 'createdDate',
      label: 'Data de Criação',
      type: 'daterange' as const
    }
  ];

  // Cores e labels vêm de '@/lib/statusHelpers'

  const getPlanColor = useCallback((plan: string) => {
    // Cores baseadas nos nomes reais dos planos
    if (plan.toLowerCase().includes('basico')) return '#3b82f6';
    if (plan.toLowerCase().includes('premium')) return '#8b5cf6';
    if (plan.toLowerCase().includes('exclusive')) return '#f59e0b';
    if (plan.toLowerCase().includes('enterprise')) return '#ef4444';
    if (plan.toLowerCase().includes('starter')) return '#10b981';
    if (plan.toLowerCase().includes('pro')) return '#6366f1';
    if (plan.toLowerCase().includes('business')) return '#f97316';
    if (plan.toLowerCase().includes('unlimited')) return '#ec4899';
    // Cores para planos sem nome específico ou "Sem Plano"
    if (plan === 'Sem Plano' || plan === 'Sem plano') return '#6b7280';
    // Cor padrão para outros planos
    return '#64748b';
  }, []);

  const formatDate = useCallback((date: Date | undefined) => {
    if (!date) return 'Nunca';
    return date.toLocaleDateString('pt-BR');
  }, []);

  // Função para calcular dias restantes do plano (prefer backend; fallback UTC-aligned)
  const calculateDaysRemaining = useCallback((user: AdminUser) => {
    // 1) Preferir valor do backend quando disponível
    if (typeof user.daysRemaining === 'number' && isFinite(user.daysRemaining) && user.daysRemaining >= 0) {
      return user.daysRemaining;
    }
    // 2) Fallback: calcular em UTC (mesma lógica do backend)
    return computeDaysRemainingUTC(user.planExpiresAt);
  }, []);

  // Função para verificar se usuário tem plano ativo
  const hasActivePlan = useCallback((user: AdminUser) => {
    return calculateDaysRemaining(user) > 0;
  }, [calculateDaysRemaining]);

  // Função para verificar se o plano está ativo (baseada na lógica do MainLayout)
  const isPlanActive = useCallback((user: AdminUser) => {
    const daysRemaining = calculateDaysRemaining(user);
    const status = user.planStatus;
    
    // Plano ativo se:
    // 1. Status é TRUE (válido) E tem dias restantes > 0
    // 2. OU se não há status definido mas tem dias restantes
    const isActive = (status === true && daysRemaining > 0) || (status === undefined && daysRemaining > 0);
    
    // cálculo silencioso de status do plano
    
    return isActive;
  }, [calculateDaysRemaining]);

  // Função para verificar se o plano está vencido (prefere backend)
  const isPlanExpired = useCallback((user: AdminUser) => {
    const daysRemaining = calculateDaysRemaining(user);
    const status = user.planStatus;
    // Plano é considerado vencido se dias restantes = 0 ou status explicitamente FALSE
    return daysRemaining === 0 || status === false;
  }, [calculateDaysRemaining]);

  // Função para calcular quantos dias o plano está vencido (UTC)
  const getDaysExpired = useCallback((user: AdminUser) => {
    if (!user.planExpiresAt || !isPlanExpired(user)) return 0;
    return computeDaysExpiredUTC(user.planExpiresAt);
  }, [isPlanExpired]);

  // Função para obter texto do status do plano
  const getPlanStatusText = useCallback((user: AdminUser) => {
    const status = user.planStatus;
    const days = calculateDaysRemaining(user);
    // Sem informações de plano (nem backend daysRemaining nem expiração)
    if (days === 0 && !user.planExpiresAt && (status === undefined || status === null)) return 'Sem Plano';
    if (status === false || days === 0) return 'Vencido';
    if (days > 0 && (status === true || status === undefined)) return 'Ativo';
    return 'Indefinido';
  }, [calculateDaysRemaining]);

  // Funções para o modal de novo usuário
  const openNewUserModal = () => {
    setNewUser({
      name: '',
      username: '',
      email: '',
      company: '',
      phone: '',
      plan: 'Basic',
      status: 'active',
      password: '',
      type: 'client'
    });
    closeAllModals();
    setShowNewUserModal(true);
  };

  const closeNewUserModal = () => {
    setShowNewUserModal(false);
    setNewUser({
      name: '',
      username: '',
      email: '',
      company: '',
      phone: '',
      plan: 'Basic',
      status: 'active',
      password: '',
      type: 'client'
    });
  };

  const handleNewUserSubmit = async () => {
    // Validações
    if (!newUser.name.trim()) {
      toast.error('Erro de Validação', 'Nome é obrigatório');
      return;
    }
    
    if (!newUser.username.trim()) {
      toast.error('Erro de Validação', 'Nome de usuário é obrigatório');
      return;
    }
    
    if (!newUser.email.trim() || !newUser.email.includes('@')) {
      toast.error('Erro de Validação', 'Email válido é obrigatório');
      return;
    }
    
    if (!newUser.password.trim() || newUser.password.length < 6) {
      toast.error('Erro de Validação', 'Senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      // Normalizar role para os valores aceitos pelo backend
      const roleMap: Record<string, 'user' | 'admin' | 'reseller' | 'collaborator'> = {
        cliente: 'user',
        client: 'user',
        admin: 'admin',
        revenda: 'reseller',
        reseller: 'reseller',
        colaborador: 'collaborator',
        collaborator: 'collaborator'
      };
      const normalizedRole = roleMap[newUser.type] || 'user';

      // Resolver planId a partir do plano selecionado
      // 1) Se já vier como UUID, usar direto
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      let resolvedPlanId: string | undefined;
      let resolvedPlanDays: number | undefined;
      if (typeof newUser.plan === 'string' && uuidRegex.test(newUser.plan)) {
        resolvedPlanId = newUser.plan;
        // Se veio só o UUID, tentar achar os dias pelo array carregado (quando disponível)
        const matched = availablePlans.find((p: any) => p?.id === newUser.plan);
        if (matched) {
          resolvedPlanDays = Number(matched.period_days ?? matched.periodDays);
        }
      } else {
        // 2) Tentar resolver por id ou name dentro de availablePlans
        const selectedPlan = availablePlans.find((p: any) => p?.id === newUser.plan || p?.name === newUser.plan);
        resolvedPlanId = selectedPlan?.id ? String(selectedPlan.id) : undefined;
        resolvedPlanDays = selectedPlan ? Number(selectedPlan.period_days ?? selectedPlan.periodDays) : undefined;
      }

      // Criar usuário usando a API real (senha em texto; backend/service faz hash)
      const createUserData = {
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        password: newUser.password,
        company: newUser.company,
        phone: normalizePhoneToSave(newUser.phone),
        role: normalizedRole as 'user' | 'admin' | 'reseller' | 'collaborator',
        status: newUser.status as 'active' | 'inactive' | 'suspended' | 'pending',
        planId: resolvedPlanId,
        planValidityDays: (typeof resolvedPlanDays === 'number' && resolvedPlanDays > 0) ? resolvedPlanDays : undefined
      };
      
      const createdUser = await usersServiceWithFallback.createUser(createUserData);
      const convertedUser = convertBackendUser(createdUser);
      
      // Adicionar usuário ao estado
      setUsers(prevUsers => [...prevUsers, convertedUser]);
      
      toast.success('Usuário Criado', `${newUser.name} foi criado com sucesso!`);
      closeNewUserModal();
    } catch (error) {
      // Erro ao criar usuário
      toast.error('Erro', 'Erro ao criar usuário. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Funções para o modal de retirar créditos
  const openWithdrawCreditsModal = (userId: string) => {
    setSelectedUserId(userId);
    setCreditsData({ amount: '', note: '' });
    setShowWithdrawCreditsModal(true);
  };

  const closeWithdrawCreditsModal = () => {
    setShowWithdrawCreditsModal(false);
    setSelectedUserId('');
    setCreditsData({ amount: '', note: '' });
  };

  const handleWithdrawCreditsSubmit = async () => {
    // Validações
    if (!creditsData.amount.trim() || isNaN(Number(creditsData.amount))) {
      toast.error('Erro de Validação', 'Valor deve ser um número válido');
      return;
    }

    const amount = Number(creditsData.amount);
    if (amount <= 0) {
      toast.error('Erro de Validação', 'Valor deve ser maior que zero');
      return;
    }

    const user = users.find(u => u.id === selectedUserId);
    const currentCredits = Number(user?.credits || 0);
    if (amount > currentCredits) {
      toast.error('Saldo Insuficiente', 'Valor excede o saldo disponível do usuário');
      return;
    }

    setIsLoading(true);
    try {
      await usersServiceWithFallback.withdrawCredits(selectedUserId, {
        amount: amount,
        note: creditsData.note.trim()
      });

      // Atualizar créditos do usuário no estado
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === selectedUserId 
            ? { ...u, credits: Math.max(0, (u.credits || 0) - amount) }
            : u
        )
      );

      toast.success('Créditos Retirados', `R$ ${amount.toFixed(2)} retirados de ${user?.name || 'usuário'}`);
      closeWithdrawCreditsModal();
    } catch (error) {
      console.error('Erro ao retirar créditos:', error);
      toast.error('Erro', 'Erro ao retirar créditos. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Funções para o modal de adicionar créditos
  const openAddCreditsModal = (userId: string) => {
    setSelectedUserId(userId);
    setCreditsData({ amount: '', note: '' });
    setShowAddCreditsModal(true);
  };

  const closeAddCreditsModal = () => {
    setShowAddCreditsModal(false);
    setSelectedUserId('');
    setCreditsData({ amount: '', note: '' });
  };

  const handleAddCreditsSubmit = async () => {
    // Validações
    if (!creditsData.amount.trim() || isNaN(Number(creditsData.amount))) {
      toast.error('Erro de Validação', 'Valor deve ser um número válido');
      return;
    }
    
    const amount = Number(creditsData.amount);
    if (amount <= 0) {
      toast.error('Erro de Validação', 'Valor deve ser maior que zero');
      return;
    }

    setIsLoading(true);
    try {
      // Adicionar créditos usando a API real
      await usersServiceWithFallback.addCredits(selectedUserId, {
        amount: amount,
        note: creditsData.note.trim()
      });
      
      // Atualizar créditos do usuário no estado
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === selectedUserId 
            ? { ...user, credits: user.credits + amount }
            : user
        )
      );
      
      const user = users.find(u => u.id === selectedUserId);
      toast.success('Créditos Adicionados', `R$ ${amount.toFixed(2)} adicionados para ${user?.name || 'usuário'}`);
      closeAddCreditsModal();
    } catch (error) {
      console.error('Erro ao adicionar créditos:', error);
      toast.error('Erro', 'Erro ao adicionar créditos. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para confirmar exclusão de usuário
  const handleDeleteUser = (user: AdminUser) => {
    const current = unifiedAuthService.getCurrentUser();
    const selfId = (current && (current as any).role === 'agent') ? (current as any).user_id : (current as any)?.id;
    if (user.id === selfId) {
      toast.info('Ação não permitida', 'Por segurança, você não pode excluir a sua própria conta.');
      return;
    }
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      setIsLoading(true);
      const result = await usersServiceWithFallback.deleteUser(userToDelete.id);
      
      // Limpar seleção se o usuário estava selecionado
      setSelectedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userToDelete.id);
        return newSet;
      });
      
      setShowDeleteModal(false);
      setUserToDelete(null);
      
      // Recarregar dados IMEDIATAMENTE e FORÇAR atualização da tela
      await loadUsers(false); // Não silencioso para garantir logs
      
      // Forçar atualização adicional se necessário
      setTimeout(async () => {
        await loadUsers(true);
      }, 500);
      
      toast.success('Usuário Excluído', result.message || 'Usuário e seus ramais excluídos com sucesso!');
      
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast.error('Erro', 'Erro ao excluir usuário. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para seleção múltipla
  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === paginatedUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(paginatedUsers.map(u => u.id)));
    }
  };

  // Função para exclusão em lote
  const handleBulkDelete = () => {
    if (selectedUsers.size === 0) {
      toast.error('Seleção Vazia', 'Selecione pelo menos um usuário para excluir');
      return;
    }
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedUsers.size === 0) return;
    
    try {
      setIsDeletingBulk(true);
      const current = unifiedAuthService.getCurrentUser();
      const selfId = (current && (current as any).role === 'agent') ? (current as any).user_id : (current as any)?.id;
      const userIds = Array.from(selectedUsers).filter(id => id !== selfId);
      if (userIds.length !== selectedUsers.size) {
        toast.info('Ação Ajustada', 'Sua própria conta foi removida da seleção por segurança');
      }
      if (userIds.length === 0) {
        setIsDeletingBulk(false);
        setShowBulkDeleteModal(false);
        return;
      }
      const result = await usersServiceWithFallback.bulkDeleteUsers(userIds);
      
      // Limpar seleção imediatamente
      setSelectedUsers(new Set());
      setShowBulkDeleteModal(false);
      
      // Recarregar dados IMEDIATAMENTE e FORÇAR atualização da tela
      await loadUsers(false); // Não silencioso para garantir logs
      
      // Forçar atualização adicional se necessário
      setTimeout(async () => {
        await loadUsers(true);
      }, 500);
      
      toast.success('Usuários Excluídos', result.message || `${userIds.length} usuários e seus ramais excluídos com sucesso!`);
      
    } catch (error) {
      console.error('Erro ao excluir usuários em lote:', error);
      toast.error('Erro', 'Erro ao excluir usuários. Tente novamente.');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  // Função para bloquear/desbloquear usuário
  const handleToggleUserStatus = async (user: AdminUser) => {
    if (isBlockingUser) return;
    
    try {
      const current = unifiedAuthService.getCurrentUser();
      const selfId = (current && (current as any).role === 'agent') ? (current as any).user_id : (current as any)?.id;
      if (user.id === selfId) {
        toast.info('Ação não permitida', 'Por segurança, você não pode alterar o status da sua própria conta.');
        return;
      }
      setIsBlockingUser(true);
      const newStatus = user.status === 'active' ? 'suspended' : 'active';
      
      await usersServiceWithFallback.updateUser(user.id, { status: newStatus });
      
      // Atualizar usuário na lista local
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, status: newStatus } : u
      ));
      
      toast.success(`Usuário ${newStatus === 'active' ? 'desbloqueado' : 'bloqueado'} com sucesso!`);
    } catch (error) {
      console.error('Erro ao alterar status do usuário:', error);
      toast.error('Erro ao alterar status do usuário');
    } finally {
      setIsBlockingUser(false);
    }
  };

  // Ações simplificadas de renovação (confirmação rápida)
  const openConfirmRenew = (user: AdminUser) => {
    setSelectedUser(user);
    setShowConfirmRenewModal(true);
  };

  const handleConfirmRenew = async () => {
    if (!selectedUser) return;
    const currentPlanId = selectedUser.planId || '';
    if (!currentPlanId) {
      toast.error('Erro', 'Usuário não possui um plano para renovar');
      return;
    }

    setIsLoading(true);
    try {
      await usersServiceWithFallback.renewPlan(
        selectedUser.id,
        currentPlanId,
        ''
      );

      toast.success('Sucesso!', `Plano renovado com sucesso para ${selectedUser.name}`);
      setShowConfirmRenewModal(false);
      await loadUsers(true);
    } catch (error) {
      console.error('❌ Erro ao renovar plano:', error);
      toast.error('Erro', 'Falha ao renovar plano');
    } finally {
      setIsLoading(false);
    }
  };

  // Funções para renovar plano
  const handleRenewPlan = (user: AdminUser) => {
    setSelectedUser(user);
    
    // Encontrar o plano atual do usuário para definir validade automática
    const currentPlan = availablePlans.find(p => p.id === user.planId);
    const defaultValidityDays = currentPlan?.periodDays?.toString() || '30';
    
    setPlanData({
      planId: user.planId || '',
      validityDays: defaultValidityDays,
      note: ''
    });
    setShowRenewPlanModal(true);
  };

  const closeRenewPlanModal = () => {
    setShowRenewPlanModal(false);
    setSelectedUser(null);
    setPlanData({ planId: '', validityDays: '30', note: '' });
  };

  // Função para atualizar validade automaticamente baseada no plano selecionado
  const updateValidityFromPlan = (planId: string) => {
    const selectedPlan = availablePlans.find(p => p.id === planId);
    const validityDays = selectedPlan?.periodDays?.toString() || '30';
    setPlanData(prev => ({ ...prev, planId, validityDays }));
  };

  const handleRenewPlanSubmit = async () => {
    if (!selectedUser || !planData.planId) {
      toast.error('Erro de Validação', 'Selecione um plano válido');
      return;
    }

    const validityDays = Number(planData.validityDays);
    if (isNaN(validityDays) || validityDays <= 0) {
      toast.error('Erro de Validação', 'Validade deve ser um número maior que zero');
      return;
    }

    setIsLoading(true);
    try {
      // Usar API real para renovar plano
      const result = await usersServiceWithFallback.renewPlan(
        selectedUser.id,
        planData.planId,
        planData.note
      );

      // plano renovado com sucesso (silencioso)

      toast.success('Sucesso!', `Plano renovado com sucesso para ${selectedUser.name}`);
      setShowRenewPlanModal(false);
      setPlanData({ planId: '', validityDays: '30', note: '' });
      
      // Atualizar lista de usuários após renovação
      await loadUsers();
    } catch (error) {
      console.error('❌ Erro ao renovar plano:', error);
      toast.error('Erro', 'Falha ao renovar plano');
    } finally {
      setIsLoading(false);
    }
  };

  // Funções para vincular plano
  const handleLinkPlan = (user: AdminUser) => {
    setSelectedUser(user);
    setPlanData({
      planId: '',
      validityDays: '30',
      note: ''
    });
    setShowLinkPlanModal(true);
  };

  const closeLinkPlanModal = () => {
    setShowLinkPlanModal(false);
    setSelectedUser(null);
    setPlanData({ planId: '', validityDays: '30', note: '' });
  };

  const handleLinkPlanSubmit = async () => {
    if (!selectedUser || !planData.planId) {
      toast.error('Erro de Validação', 'Selecione um plano válido');
      return;
    }

    const validityDays = Number(planData.validityDays);
    if (isNaN(validityDays) || validityDays <= 0) {
      toast.error('Erro de Validação', 'Validade deve ser um número maior que zero');
      return;
    }

    setIsLoading(true);
    try {
      const result = await usersServiceWithFallback.linkPlan(
        selectedUser.id,
        planData.planId,
        validityDays,
        planData.note
      );
      
      // Buscar nome do plano para exibição
      const selectedPlan = availablePlans.find(p => p.id === planData.planId);
      
      // Atualizar usuário no estado local com dados reais
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === selectedUser.id 
            ? { 
                ...user, 
                planId: planData.planId,
                planName: selectedPlan?.name,
                plan: selectedPlan?.name,
                planStatus: true,
                planActivatedAt: result.activatedAt,
                planExpiresAt: result.expiresAt
              }
            : user
        )
      );
      
      toast.success('Plano Vinculado', `Plano ${selectedPlan?.name} vinculado por ${validityDays} dias para ${selectedUser.name}`);
      closeLinkPlanModal();
      
    } catch (error) {
      console.error('❌ Erro ao vincular plano:', error);
      toast.error('Erro', `Erro ao vincular plano: ${error instanceof Error ? error.message : 'Tente novamente.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Funções para visualização de usuário
  const handleViewUser = (user: AdminUser) => {
    setSelectedUser(user);
    setShowViewUserModal(true);
  };

  const closeViewUserModal = () => {
    setShowViewUserModal(false);
    setSelectedUser(null);
  };

  // Funções para edição de usuário
  const handleEditUser = (user: AdminUser) => {
    setSelectedUser(user);
    // Preencher dados do usuário no formulário de edição
    setNewUser({
      name: user.name,
      username: user.username,
      email: user.email,
      company: user.company,
      phone: user.phone,
      plan: user.planId ? user.planId : 'Basic',
      status: user.status,
      password: '', // Senha em branco para edição
      type: user.type || 'client'
    });
    setShowEditUserModal(true);
  };

  const closeEditUserModal = () => {
    setShowEditUserModal(false);
    setSelectedUser(null);
    setNewUser({
      name: '',
      username: '',
      email: '',
      company: '',
      phone: '',
      plan: 'Basic',
      status: 'active',
      password: '',
      type: 'client'
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    // Validação dos campos obrigatórios
    if (!newUser.name.trim() || !newUser.email.trim()) {
      toast.error('Erro de Validação', 'Nome e Email são obrigatórios');
      return;
    }

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email)) {
      toast.error('Erro de Validação', 'Email inválido');
      return;
    }
    
    setIsLoading(true);
    try {
      // Atualizar usuário usando a API real
      const updatedUserData = {
        ...newUser,
        id: selectedUser.id
      };
      
      await usersServiceWithFallback.updateUser(selectedUser.id, updatedUserData);
      
      // Atualizar usuário no estado local
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === selectedUser.id 
            ? { ...user, ...convertBackendUser(updatedUserData) }
            : user
        )
      );
      
      // Fechar modal primeiro
      closeEditUserModal();
      
      // Toast de sucesso após fechar o modal
      setTimeout(() => {
        toast.success('Usuário Atualizado', `${newUser.name} foi atualizado com sucesso`);
      }, 100);
      
      // Forçar atualização da tela em segundo plano
      setTimeout(() => {
        // Recarregar dados se necessário
        if (typeof window !== 'undefined') {
          // Trigger de re-render forçado
          setUsers(prevUsers => [...prevUsers]);
        }
      }, 200);
      
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      toast.error('Erro', 'Erro ao atualizar usuário. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Função de exportação de dados
  const handleExport = async (format: string, data: any[]) => {
    const exportData = data.map(user => ({
      'Nome': user.name,
      'Email': user.email,
      'Empresa': user.company,
      'Telefone': user.phone,
      'Plano': (user as any).planName || user.plan || 'Sem Plano',
      'Tipo': user.type === 'client' ? 'Cliente' : 
              user.type === 'reseller' ? 'Revenda' : 
              user.type === 'admin' ? 'Administrador' : 'Colaborador',
      'Status': user.status === 'active' ? 'Ativo' : 
                user.status === 'inactive' ? 'Inativo' : 'Suspenso',
      'Créditos': typeof user.credits === 'number' ? `R$ ${user.credits.toFixed(2)}` : user.credits,
      'Data de Criação': new Date(user.createdAt).toLocaleDateString('pt-BR')
    }));

    toast.success('Exportação Concluída', `${exportData.length} usuários exportados com sucesso`);
  };

  // Estatísticas baseadas nos dados reais carregados
  const totalUsersDisplay = totalUsersCount || users.length;
  const activeUsers = users.filter(u => u.status === 'active').length;
  const totalCredits = users.reduce((sum, u) => sum + u.credits, 0);
  const averageCredits = totalUsersDisplay > 0 ? totalCredits / totalUsersDisplay : 0;

  // Exibir loading screen leve até carregar os usuários
  if (isLoadingUsers) {
    return (
      <MainLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ width: '3rem', height: '3rem', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
          <div style={{ color: '#475569', fontWeight: 500 }}>Carregando usuários...</div>
        </div>
        <style jsx global>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div style={{ 
        padding: '2rem', 
        minHeight: '100vh', 
        background: '#f8fafc'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
              Gerenciamento de Usuários
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Administre todos os usuários do sistema
            </p>
          </div>
          
        </div>

        {/* Loading inline removido: agora usamos tela de loading inicial */}

        {/* API Status Info removed per request */}

        {/* Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '1.5rem', 
          marginBottom: '2rem' 
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <UserCheck size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {totalUsersDisplay}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Total de Usuários</p>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Shield size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {activeUsers}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Usuários Ativos</p>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <User size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              R$ {totalCredits.toFixed(2)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Total de Créditos</p>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Phone size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              R$ {averageCredits.toFixed(2)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Média de Créditos</p>
          </div>
        </div>

        {/* Filtros Avançados */}
        <AdvancedFilters
          fields={filterFields}
          onFiltersChange={setFilters}
          initialFilters={filters}
        />

        {/* Filtros e Ações - Design Minimalista */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          border: '1px solid #f1f5f9',
          marginBottom: '24px'
        }}>
          {/* Linha Principal */}
          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: selectedUsers.size > 0 ? '16px' : '0'
          }}>
            {/* Busca */}
            <div style={{ 
              position: 'relative', 
              flex: '1', 
              minWidth: '280px'
            }}>
              <Search style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                width: '18px', 
                height: '18px', 
                color: '#94a3b8',
                strokeWidth: 1.5
              }} />
              <input
                type="text"
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 44px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#fafafa',
                  transition: 'all 0.2s ease',
                  fontWeight: '400'
                }}
                onFocus={(e) => {
                  e.target.style.backgroundColor = 'white';
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.backgroundColor = '#fafafa';
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            
            {/* Ações */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              {/* Filtro Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: '#fafafa',
                  minWidth: '140px',
                  cursor: 'pointer',
                  fontWeight: '400',
                  color: '#475569'
                }}
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="suspended">Suspensos</option>
              </select>
              
              {/* Exportar */}
              <DataExport
                data={filteredUsers}
                filename="usuarios-admin"
                title="Exportar"
                onExport={handleExport}
              />
              
              {/* Novo Usuário */}
              <button
                onClick={openNewUserModal}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
              >
                <Plus size={18} strokeWidth={2} />
                <span style={{ display: window.innerWidth < 640 ? 'none' : 'inline' }}>Novo Usuário</span>
              </button>
            </div>
          </div>
          
          {/* Ações em Lote - Design Minimalista */}
          {selectedUsers.size > 0 && (
            <div style={{
              backgroundColor: '#fef9e7',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              boxShadow: '0 6px 12px -8px rgba(0,0,0,0.15)',
              backdropFilter: 'saturate(180%) blur(6px)'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                minWidth: 'fit-content'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#f59e0b',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Users size={16} style={{ color: 'white' }} />
                </div>
                <span style={{ 
                  color: '#92400e', 
                  fontWeight: '500',
                  fontSize: '14px'
                }}>
                  {selectedUsers.size} selecionado{selectedUsers.size !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={handleBulkBlock}
                  disabled={isBulkBlocking || isDeletingBulk}
                  style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#f97316', 
                    color: 'white',
                    border: 'none', 
                    borderRadius: '6px', 
                    cursor: 'pointer',
                    opacity: isBulkBlocking || isDeletingBulk ? 0.6 : 1,
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  title="Bloquear selecionados"
                >
                  {isBulkBlocking ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={14} />}
                  Bloquear
                </button>
                
                <button
                  onClick={handleBulkUnblock}
                  disabled={isBulkUnblocking || isDeletingBulk}
                  style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#10b981', 
                    color: 'white',
                    border: 'none', 
                    borderRadius: '6px', 
                    cursor: 'pointer',
                    opacity: isBulkUnblocking || isDeletingBulk ? 0.6 : 1,
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  title="Desbloquear selecionados"
                >
                  {isBulkUnblocking ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Unlock size={14} />}
                  Desbloquear
                </button>
                
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeletingBulk}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: isDeletingBulk ? 'not-allowed' : 'pointer',
                    opacity: isDeletingBulk ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Trash2 size={14} />
                  {isDeletingBulk ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          )}

          {/* Quick Status Filter Chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {[
              { key: 'all', label: 'Todos' },
              { key: 'active', label: 'Ativos' },
              { key: 'inactive', label: 'Inativos' },
              { key: 'suspended', label: 'Suspensos' }
            ].map(({ key, label }) => {
              const selected = statusFilter === key;
              const count = key === 'all' ? users.length : users.filter(u => u.status === (key as any)).length;
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '9999px',
                    border: selected ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                    backgroundColor: selected ? '#eff6ff' : '#ffffff',
                    color: selected ? '#1d4ed8' : '#334155',
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  title={`Filtrar: ${label}`}
                >
                  <span>{label}</span>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '10px',
                    backgroundColor: selected ? '#dbeafe' : '#f1f5f9',
                    color: selected ? '#1d4ed8' : '#475569',
                    fontSize: '11px',
                    fontWeight: 600
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Users Table/Cards */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          {/* Conteúdo da Tabela - Carregamento Instantâneo */}
          {
            <>
            {!isMobile ? (
            // Desktop Table
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb', width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={selectedUsers.size === paginatedUsers.length && paginatedUsers.length > 0}
                        onChange={handleSelectAll}
                        style={{
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer'
                        }}
                      />
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Nome</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Plano</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Dias</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Tipo</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Créditos</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Último Login</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingUsers ? (
                    // Skeleton rows
                    Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={`sk-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {Array.from({ length: 9 }).map((__, cidx) => (
                          <td key={`skc-${idx}-${cidx}`} style={{ padding: '1rem' }}>
                            <div style={{ height: '12px', width: cidx === 1 ? '50%' : '80%', backgroundColor: '#e5e7eb', borderRadius: '6px' }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                          <Users size={20} />
                          <div style={{ fontWeight: 500 }}>Nenhum usuário encontrado</div>
                          <div style={{ fontSize: '0.875rem' }}>Ajuste os filtros ou crie um novo usuário</div>
                          <button
                            onClick={openNewUserModal}
                            style={{
                              marginTop: '0.25rem',
                              padding: '8px 14px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 500,
                              cursor: 'pointer'
                            }}
                          >
                            <Plus size={14} /> Novo Usuário
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                  paginatedUsers.map((user) => {
                    const isExpired = isPlanExpired(user);
                    const daysExpired = getDaysExpired(user);
                    
                    return (
                    <tr key={user.id} style={{ 
                      borderBottom: '1px solid #f1f5f9',
                      position: 'relative'
                    }}>
                      <td style={{ 
                        padding: '1rem', 
                        textAlign: 'center',
                        backgroundColor: isExpired ? 'rgba(251, 146, 60, 0.08)' : 'transparent',
                        borderLeft: isExpired ? '3px solid #f97316' : 'none',
                        position: 'relative'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer'
                          }}
                        />
                        {/* Indicador de plano vencido - mais discreto */}
                        {isExpired && (
                          <div style={{
                            position: 'absolute',
                            top: '0.25rem',
                            right: '0.25rem',
                            backgroundColor: '#f97316',
                            color: 'white',
                            fontSize: '0.5rem',
                            fontWeight: '700',
                            padding: '0.125rem 0.25rem',
                            borderRadius: '0.125rem',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
                            lineHeight: '1'
                          }}>
                            {daysExpired > 0 ? `${daysExpired}d` : 'EXP'}
                          </div>
                        )}
                      </td>
                    <td style={{ 
                      padding: '1rem',
                      backgroundColor: isExpired ? 'rgba(251, 146, 60, 0.08)' : 'transparent'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '2.5rem',
                          height: '2.5rem',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>
                            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <div style={{ 
                            fontWeight: '500', 
                            color: '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            {user.name}
                            {isExpired && (
                              <span style={{
                                backgroundColor: '#f97316',
                                color: 'white',
                                fontSize: '0.625rem',
                                fontWeight: '700',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem',
                                textTransform: 'uppercase'
                              }}>
                                Vencido {daysExpired}d
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ 
                      padding: '1rem',
                      backgroundColor: isExpired ? 'rgba(251, 146, 60, 0.08)' : 'transparent'
                    }}>
                      {(() => {
                        const planName = (user as any).planName || user.plan || 'Sem Plano';
                        const isSemPlano = !planName || planName === 'Sem Plano' || planName === 'Sem plano';
                        const color = isSemPlano ? '#64748b' : (isExpired ? '#dc2626' : '#2563eb');
                        
                        return (
                          <span 
                            style={{
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              color: color,
                              cursor: isSemPlano ? 'default' : 'help'
                            }}
                            title={isSemPlano ? 'Usuário sem plano' : (user.planActivatedAt ? `Plano ativo desde ${new Date(user.planActivatedAt).toLocaleDateString('pt-BR')}` : 'Plano vinculado')}
                          >
                            {planName}
                          </span>
                        );
                      })()} 
                    </td>
                    <td style={{ 
                      padding: '1rem',
                      backgroundColor: isExpired ? 'rgba(251, 146, 60, 0.08)' : 'transparent'
                    }}>
                      {(() => {
                        const daysRemaining = calculateDaysRemaining(user);
                        const hasRealPlan = user.planExpiresAt;
                        if (!hasRealPlan) {
                          return (
                            <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontWeight: '400' }}>-</span>
                          );
                        }
                        return (
                          <PlanPill daysRemaining={daysRemaining} expiresAt={user.planExpiresAt!} size="sm" />
                        );
                      })()}
                    </td>
                    <td style={{ 
                      padding: '1rem',
                      backgroundColor: isExpired ? 'rgba(251, 146, 60, 0.08)' : 'transparent'
                    }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: '#eef2ff',
                        color: '#4338ca'
                      }}>
                        {user.role === 'user' ? 'Cliente' : user.role === 'admin' ? 'Admin' : user.role === 'reseller' ? 'Revendedor' : 'Colaborador'}
                      </span>
                    </td>
                    <td style={{ 
                      padding: '1rem',
                      backgroundColor: isExpired ? 'rgba(251, 146, 60, 0.08)' : 'transparent'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <StatusPill status={user.status as any} size="sm" />
                        <button
                          onClick={() => handleToggleUserStatus(user)}
                          disabled={isBlockingUser}
                          style={{
                            padding: '0.25rem',
                            backgroundColor: user.status === 'active' ? '#fef2f2' : '#f0fdf4',
                            border: `1px solid ${user.status === 'active' ? '#fecaca' : '#bbf7d0'}`,
                            borderRadius: '0.25rem',
                            cursor: isBlockingUser ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            opacity: isBlockingUser ? 0.6 : 1
                          }}
                          title={user.status === 'active' ? 'Bloquear usuário' : 'Desbloquear usuário'}
                        >
                          {user.status === 'active' ? 
                            <Ban style={{ width: '0.875rem', height: '0.875rem', color: '#ef4444' }} /> :
                            <CheckCircle style={{ width: '0.875rem', height: '0.875rem', color: '#16a34a' }} />
                          }
                        </button>
                      </div>
                    </td>
                    <td style={{ 
                      padding: '1rem',
                      backgroundColor: isExpired ? 'rgba(251, 146, 60, 0.08)' : 'transparent',
                      textAlign: 'right'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <span style={{ fontWeight: '500', color: '#1e293b' }}>
                          R$ {user.credits.toFixed(2)}
                        </span>
                        <button
                          onClick={() => openAddCreditsModal(user.id)}
                          style={{
                            padding: '0.25rem',
                            backgroundColor: '#16a34a',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#15803d';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#16a34a';
                          }}
                          title="Adicionar créditos"
                        >
                          <CreditCard style={{ width: '0.875rem', height: '0.875rem', color: 'white' }} />
                        </button>
                        <button
                          onClick={() => openWithdrawCreditsModal(user.id)}
                          style={{
                            padding: '0.25rem',
                            backgroundColor: '#ef4444',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#dc2626';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#ef4444';
                          }}
                          title="Retirar créditos"
                        >
                          <MinusCircle style={{ width: '0.875rem', height: '0.875rem', color: 'white' }} />
                        </button>
                      </div>
                    </td>
                    <td style={{ 
                      padding: '1rem', 
                      color: '#64748b',
                      backgroundColor: isExpired ? 'rgba(251, 146, 60, 0.08)' : 'transparent'
                    }}>
                      {formatDate(user.lastLogin)}
                    </td>
                    <td style={{ 
                      padding: '1rem',
                      backgroundColor: isExpired ? 'rgba(251, 146, 60, 0.08)' : 'transparent'
                    }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {/* Ações primárias visíveis */}
                        <button
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#f0f9ff',
                            border: '1px solid #e0f2fe',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            color: '#0369a1'
                          }}
                          title="Visualizar"
                          onClick={() => handleViewUser(user)}
                        >
                          <Eye style={{ width: '1rem', height: '1rem' }} />
                        </button>
                        <button
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            color: '#64748b'
                          }}
                          title="Editar"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit style={{ width: '1rem', height: '1rem' }} />
                        </button>

                        {/* Menu de ações secundárias */}
                        <RowActionsMenu
                          items={(() => {
                            const hasPlan = (((user as any).planName || user.plan) && ((user as any).planName || user.plan) !== 'Sem Plano');
                            return [
                              {
                                label: 'Gerenciar Cliente',
                                onClick: () => (window.location.href = `/admin/users/manage/${user.id}`),
                                icon: <UserCog style={{ width: '1rem', height: '1rem', color: '#16a34a' }} />,
                              },
                              hasPlan
                                ? {
                                    label: 'Renovar Plano',
                                    onClick: () => openConfirmRenew(user),
                                    icon: <Settings style={{ width: '1rem', height: '1rem', color: '#2563eb' }} />,
                                  }
                                : {
                                    label: 'Vincular Plano',
                                    onClick: () => handleLinkPlan(user),
                                    icon: <Plus style={{ width: '1rem', height: '1rem', color: '#10b981' }} />,
                                  },
                              {
                                label: 'Excluir',
                                onClick: () => handleDeleteUser(user),
                                icon: <Trash2 style={{ width: '1rem', height: '1rem', color: '#ef4444' }} />,
                              },
                            ];
                          })()}
                        />
                      </div>
                    </td>
                  </tr>
                    );
                  })
                  )}
              </tbody>
            </table>
          </div>
        ) : (
          // Mobile Cards
          <div style={{ padding: '1rem' }}>
            {paginatedUsers.map((user) => (
              <ResponsiveCard
                key={user.id}
                avatar={
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: '1rem', fontWeight: '600', color: '#64748b' }}>
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                }
                title={user.name}
                subtitle={user.email}
                status={{
                  label: user.status === 'active' ? 'Ativo' : user.status === 'inactive' ? 'Inativo' : 'Suspenso',
                  color: getStatusColor(user.status),
                  bgColor: user.status === 'active' ? '#dcfce7' : user.status === 'inactive' ? '#fef3c7' : '#fee2e2'
                }}
                fields={[
                  {
                    label: 'Plano',
                    value: (
                      <div style={{
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#eef2ff',
                        borderRadius: '0.5rem',
                        border: '1px solid rgba(99, 102, 241, 0.15)',
                        display: 'inline-block'
                      }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#4338ca'
                        }}>
                          {(user as any).planName || user.plan || 'Sem Plano'}
                        </div>
                      </div>
                    )
                  },
                  {
                    label: 'Dias Restantes',
                    value: (() => {
                      const daysRemaining = calculateDaysRemaining(user);
                      if (!user.planExpiresAt) {
                        return <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>-</span>;
                      }
                      return (
                        <PlanPill daysRemaining={daysRemaining} expiresAt={user.planExpiresAt} size="sm" />
                      );
                    })()
                  },
                  {
                    label: 'Contato',
                    value: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Building size={16} style={{ color: '#64748b' }} />
                        <div>
                          <div style={{ fontWeight: '500' }}>{user.company}</div>
                          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{user.phone}</div>
                        </div>
                      </div>
                    )
                  },
                  {
                    label: 'Plano',
                    value: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#f0f9ff',
                          color: '#0369a1',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          {(user as any).planName || user.plan || 'Sem Plano'}
                        </span>
                        {((user as any).planName || user.plan) && ((user as any).planName || user.plan) !== 'Sem Plano' && isPlanExpired(user) && (
                          <Tooltip content={`Plano ${getPlanStatusText(user)} - ${calculateDaysRemaining(user)} dias restantes`}>
                            <AlertTriangle 
                              style={{ 
                                width: '1rem', 
                                height: '1rem', 
                                color: '#ef4444',
                                cursor: 'help'
                              }} 
                            />
                          </Tooltip>
                        )}
                        {/* Botão para renovar plano (usuários com plano) */}
                        {((user as any).planName || user.plan) && ((user as any).planName || user.plan) !== 'Sem Plano' && (
                          <Tooltip content="Renovar Plano">
                            <button
                              onClick={() => openConfirmRenew(user)}
                              style={{
                                padding: '0.25rem',
                                border: 'none',
                                borderRadius: '0.375rem',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#2563eb';
                                e.currentTarget.style.transform = 'scale(1.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#3b82f6';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            >
                              <Settings style={{ width: '0.875rem', height: '0.875rem' }} />
                            </button>
                          </Tooltip>
                        )}
                        {/* Botão para vincular plano (usuários sem plano) */}
                        {(!((user as any).planName || user.plan) || ((user as any).planName || user.plan) === 'Sem Plano') && (
                          <Tooltip content="Vincular Plano">
                            <button
                              onClick={() => handleLinkPlan(user)}
                              style={{
                                padding: '0.25rem',
                                border: 'none',
                                borderRadius: '0.375rem',
                                backgroundColor: '#10b981',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#059669';
                                e.currentTarget.style.transform = 'scale(1.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#10b981';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            >
                              <Plus style={{ width: '0.875rem', height: '0.875rem' }} />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    )
                  },
                  {
                    label: 'Tipo',
                    value: (
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: '#eef2ff',
                        color: '#4338ca',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {user.role === 'user' ? 'Cliente' : user.role === 'admin' ? 'Admin' : user.role === 'reseller' ? 'Revendedor' : 'Colaborador'}
                      </span>
                    )
                  },
                  {
                    label: 'Créditos',
                    value: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <DollarSign size={16} style={{ color: '#10b981' }} />
                        <span style={{ fontWeight: '600', color: '#10b981' }}>
                          R$ {typeof user.credits === 'number' ? user.credits.toFixed(2) : user.credits}
                        </span>
                      </div>
                    ),
                    highlight: true
                  },
                  {
                    label: 'Último Login',
                    value: user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('pt-BR') : 'N/A'
                  }
                ]}
                actions={
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Tooltip content="Visualizar usuário">
                      <button
                        onClick={() => handleViewUser(user)}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: '#f0f9ff',
                          border: '1px solid #e0f2fe',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          color: '#0369a1'
                        }}
                      >
                        <Eye size={16} />
                      </button>
                    </Tooltip>
                    
                    <Tooltip content="Adicionar créditos">
                      <button
                        onClick={() => openAddCreditsModal(user.id)}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #dcfce7',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          color: '#16a34a'
                        }}
                      >
                        <DollarSign size={16} />
                      </button>
                    </Tooltip>

                    <Tooltip content="Retirar créditos">
                      <button
                        onClick={() => openWithdrawCreditsModal(user.id)}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          color: '#ef4444'
                        }}
                      >
                        <MinusCircle size={16} />
                      </button>
                    </Tooltip>
                    
                    <Tooltip content="Editar usuário">
                      <button
                        onClick={() => handleEditUser(user)}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          color: '#64748b'
                        }}
                      >
                        <Edit size={16} />
                      </button>
                    </Tooltip>
                    
                    <Tooltip content="Bloquear/Desbloquear usuário">
                      <button
                        onClick={() => handleToggleUserStatus(user)}
                        disabled={isBlockingUser}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: user.status === 'active' ? '#fef2f2' : '#f0fdf4',
                          border: `1px solid ${user.status === 'active' ? '#fecaca' : '#bbf7d0'}`,
                          borderRadius: '0.375rem',
                          cursor: isBlockingUser ? 'not-allowed' : 'pointer',
                          opacity: isBlockingUser ? 0.6 : 1,
                          color: user.status === 'active' ? '#ef4444' : '#16a34a'
                        }}
                      >
                        {user.status === 'active' ? 
                          <Ban size={16} /> :
                          <CheckCircle size={16} />
                        }
                      </button>
                    </Tooltip>
                    
                    <Tooltip content="Excluir usuário">
                      <button
                        onClick={() => handleDeleteUser(user)}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          color: '#ef4444'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </Tooltip>
                  </div>
                }
              />
            ))}
          </div>
        )}
            </>
          }
        </div>
        
        {/* Paginação */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          itemsPerPage={itemsPerPage}
          totalItems={totalItems}
          showInfo={true}
        />
        
        {/* Empty State */}
        {filteredUsers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <UserCheck size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Nenhum usuário encontrado</p>
          </div>
        )}
      </div>

      {/* Modal de Novo Usuário - Design Clean */}
      {showNewUserModal && (
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
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0',
            boxShadow: 'none',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Header do Modal */}
            <div style={{
              padding: '1.5rem 1.5rem 1rem 1.5rem',
              borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#1e293b'
              }}>Novo Usuário</h2>
              <button
                onClick={() => setShowNewUserModal(false)}
                style={{
                  padding: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem', color: '#6b7280' }} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{ padding: '1.5rem' }}>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleNewUserSubmit();
              }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(2, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '1.5rem',
                width: '100%',
                overflow: 'hidden',
                boxSizing: 'border-box'
              }}>
                <div style={{
                  width: '100%',
                  minWidth: '0',
                  boxSizing: 'border-box'
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Nome Completo *</label>
                  <input
                    type="text"
                    value={newUser.name || ''}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    placeholder="Digite o nome completo"
                    required
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      minWidth: '0',
                      padding: '0.75rem 1rem',
                      border: '1px solid rgba(209, 213, 219, 0.8)',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      background: 'rgba(255, 255, 255, 0.8)',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6366f1';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                      e.target.style.boxShadow = 'none';
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
                  }}>Nome de Usuário</label>
                  <input
                    type="text"
                    value={newUser.username || ''}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box'
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
                  }}>Email</label>
                  <input
                    type="email"
                    value={newUser.email || ''}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box'
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
                  }}>Empresa</label>
                  <input
                    type="text"
                    value={newUser.company || ''}
                    onChange={(e) => setNewUser({...newUser, company: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box'
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
                  }}>Telefone</label>
                  <input
                    type="tel"
                    value={newUser.phone || ''}
                    onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box'
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
                  }}>Plano</label>
                  <select
                    value={newUser.plan || 'Basic'}
                    onChange={(e) => setNewUser({...newUser, plan: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      backgroundColor: 'white',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">Selecione um plano</option>
                    {availablePlans.map((plan) => (
                      <option key={plan.id} value={plan.name}>
                        {plan.name} - R$ {plan.price.toFixed(2)}/mês
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Status</label>
                  <select
                    value={newUser.status || 'active'}
                    onChange={(e) => setNewUser({...newUser, status: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      backgroundColor: 'white',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                    <option value="suspended">Suspenso</option>
                  </select>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Tipo de Usuário</label>
                  <select
                    value={newUser.type || 'cliente'}
                    onChange={(e) => setNewUser({...newUser, type: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      backgroundColor: 'white',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="cliente">Cliente</option>
                    <option value="revenda">Revenda</option>
                    <option value="admin">Administrador</option>
                    <option value="colaborador">Colaborador</option>
                  </select>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Senha *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newUser.password || ''}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem 2.75rem 0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={toggleShowPassword}
                      aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                      title={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        padding: '0.25rem',
                        cursor: 'pointer',
                        color: '#6b7280'
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(243, 244, 246, 0.8)',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '0.5rem',
                    color: '#374151',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(229, 231, 235, 0.9)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(243, 244, 246, 0.8)';
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                    transition: 'all 0.2s ease'
                  }}
                  disabled={isLoading}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(99, 102, 241, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 style={{ width: '1rem', height: '1rem' }} />
                      Criando...
                    </>
                  ) : (
                    <>
                      <UserCheck style={{ width: '1rem', height: '1rem' }} />
                      Criar Usuário
                    </>
                  )}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Bloquear em Lote */}
      <SimpleConfirmModal
        isOpen={showBulkBlockModal}
        count={selectedUsers.size}
        loading={isBulkBlocking}
        title="Confirmar Bloqueio em Lote"
        description="Os usuários selecionados terão o status alterado para Suspenso."
        accentColor="#f97316"
        Icon={Lock}
        onCancel={() => setShowBulkBlockModal(false)}
        onConfirm={confirmBulkBlock}
      />

      {/* Modal de Confirmação para Desbloquear em Lote */}
      <SimpleConfirmModal
        isOpen={showBulkUnblockModal}
        count={selectedUsers.size}
        loading={isBulkUnblocking}
        title="Confirmar Desbloqueio em Lote"
        description="Os usuários selecionados terão o status alterado para Ativo."
        accentColor="#10b981"
        Icon={Unlock}
        onCancel={() => setShowBulkUnblockModal(false)}
        onConfirm={confirmBulkUnblock}
      />

      {/* Modal de Confirmação de Renovação (simplificado) */}
      {showConfirmRenewModal && selectedUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000
          }}
          onClick={() => setShowConfirmRenewModal(false)}
        >
          <div
            className="modal-renovar-plano"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1rem',
              border: '1px solid rgba(226, 232, 240, 0.6)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '100%',
              maxWidth: '520px',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>Confirmar Renovação</h2>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Renovar plano atual para {selectedUser.name}</p>
              </div>
              <button
                onClick={() => setShowConfirmRenewModal(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  cursor: 'pointer'
                }}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.25rem' }}>
              <p style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '0.95rem' }}>
                Tem certeza que deseja renovar o plano atual deste usuário? Esta ação irá recalcular a data de expiração com base no plano vinculado.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowConfirmRenewModal(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    background: 'white',
                    color: '#111827',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmRenew}
                  disabled={isLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid transparent',
                    background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                    color: 'white',
                    cursor: 'pointer',
                    opacity: isLoading ? 0.8 : 1
                  }}
                >
                  {isLoading ? 'Renovando...' : 'Confirmar Renovação'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DUPLICADO REMOVIDO */}
      {false && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewUserModal(false);
            }
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1f2937'
                }}
              >
                Novo Usuário
              </h2>
              <button
                onClick={() => setShowNewUserModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem', color: '#6b7280' }} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              <form>
                <div style={{ 
                  display: 'grid', 
                  gap: '1.25rem', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
                }}>
                  {/* Nome */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '0.5rem'
                      }}
                    >
                      Nome *
                    </label>
                    <input
                      type="text"
                      value={newUser.name}
                      onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '0.5rem'
                      }}
                    >
                      Email *
                    </label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Telefone */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Telefone</label>
                    <input
                      type="tel"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Plano */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Plano</label>
                    <select
                      value={newUser.plan}
                      onChange={(e) => setNewUser({...newUser, plan: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        backgroundColor: 'white',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="Basic">Basic</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Status</label>
                    <select
                      value={newUser.status}
                      onChange={(e) => setNewUser({...newUser, status: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        backgroundColor: 'white',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                      <option value="suspended">Suspenso</option>
                    </select>
                  </div>

                  {/* Tipo de Usuário */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Tipo de Usuário</label>
                    <select
                      value={newUser.type}
                      onChange={(e) => setNewUser({...newUser, type: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        backgroundColor: 'white',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="cliente">Cliente</option>
                      <option value="revenda">Revenda</option>
                      <option value="admin">Administrador</option>
                      <option value="colaborador">Colaborador</option>
                    </select>
                  </div>

                  {/* Senha */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Senha</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '0.75rem 2.75rem 0.75rem 1rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={toggleShowPassword}
                        aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                        title={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                        style={{
                          position: 'absolute',
                          right: '0.5rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          padding: '0.25rem',
                          cursor: 'pointer',
                          color: '#6b7280'
                        }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    justifyContent: 'flex-end',
                    marginTop: '1.5rem'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowNewUserModal(false)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(243, 244, 246, 0.8)',
                      border: '1px solid rgba(209, 213, 219, 0.8)',
                      borderRadius: '0.5rem',
                      color: '#374151',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(229, 231, 235, 0.9)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(243, 244, 246, 0.8)';
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.7 : 1,
                      transition: 'all 0.2s ease'
                    }}
                    disabled={isLoading}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(99, 102, 241, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 style={{ width: '1rem', height: '1rem' }} />
                        Criando...
                      </>
                    ) : (
                      <>
                        <UserCheck style={{ width: '1rem', height: '1rem' }} />
                        Criar Usuário
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Créditos */}
      {showAddCreditsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            padding: '0.5rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeAddCreditsModal();
            }
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '100%',
              maxWidth: '450px',
              maxHeight: '95vh',
              overflow: 'auto',
              margin: '0.5rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1f2937'
                }}
              >
                Adicionar Créditos
              </h2>
              <button
                onClick={closeAddCreditsModal}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem', color: '#6b7280' }} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Valor */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}
                  >
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={creditsData.amount}
                    onChange={(e) => setCreditsData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="100.00"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box',
                      minHeight: '2.75rem'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Anotação */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}
                  >
                    Anotação
                  </label>
                  <textarea
                    value={creditsData.note}
                    onChange={(e) => setCreditsData(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Observações sobre o crédito adicionado..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: '80px',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  marginTop: '1.5rem',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap'
                }}
              >
                <button
                  onClick={closeAddCreditsModal}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'transparent',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minWidth: '100px',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  Cancelar
                </button>
                
                <button
                  onClick={handleAddCreditsSubmit}
                  disabled={isLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    background: isLoading ? '#9ca3af' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                    minWidth: '140px',
                    whiteSpace: 'nowrap',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(22, 163, 74, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.3)';
                  }}
                >
                  <DollarSign style={{ width: '1rem', height: '1rem' }} />
                  {isLoading ? 'Adicionando...' : 'Adicionar Créditos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Retirar Créditos */}
      {showWithdrawCreditsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            padding: '0.5rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeWithdrawCreditsModal();
            }
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '100%',
              maxWidth: '450px',
              maxHeight: '95vh',
              overflow: 'auto',
              margin: '0.5rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1f2937'
                }}
              >
                Retirar Créditos
              </h2>
              <button
                onClick={closeWithdrawCreditsModal}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem', color: '#6b7280' }} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Valor */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}
                  >
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={creditsData.amount}
                    onChange={(e) => setCreditsData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="50.00"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box',
                      minHeight: '2.75rem'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#ef4444';
                      e.target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Anotação */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}
                  >
                    Anotação
                  </label>
                  <textarea
                    value={creditsData.note}
                    onChange={(e) => setCreditsData(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Motivo da retirada..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: '80px',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#ef4444';
                      e.target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  marginTop: '1.5rem',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap'
                }}
              >
                <button
                  onClick={closeWithdrawCreditsModal}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'transparent',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minWidth: '100px',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  Cancelar
                </button>
                
                <button
                  onClick={handleWithdrawCreditsSubmit}
                  disabled={isLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    background: isLoading ? '#9ca3af' : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                    minWidth: '160px',
                    whiteSpace: 'nowrap',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                  }}
                >
                  <MinusCircle style={{ width: '1rem', height: '1rem' }} />
                  {isLoading ? 'Retirando...' : 'Retirar Créditos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização de Usuário */}
      {showViewUserModal && selectedUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeViewUserModal();
            }
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1rem',
              padding: '2rem',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            {/* Header do Modal */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '2rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '0.75rem',
                    border: '1px solid #e0f2fe'
                  }}
                >
                  <Eye style={{ width: '1.5rem', height: '1.5rem', color: '#0369a1' }} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                    Visualizar Usuário
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                    Detalhes completos do usuário
                  </p>
                </div>
              </div>
              <button
                onClick={closeViewUserModal}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X style={{ width: '1.5rem', height: '1.5rem' }} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {/* Informações Pessoais */}
              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(0, 0, 0, 0.1)'
                }}
              >
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                  Informações Pessoais
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>Nome</label>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem', color: '#1e293b' }}>{selectedUser.name}</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>Email</label>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem', color: '#1e293b' }}>{selectedUser.email}</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>Telefone</label>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem', color: '#1e293b' }}>{selectedUser.phone || 'Não informado'}</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>Empresa</label>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem', color: '#1e293b' }}>{selectedUser.company || 'Não informado'}</p>
                  </div>
                </div>
              </div>

              {/* Informações da Conta */}
              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(0, 0, 0, 0.1)'
                }}
              >
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                  Informações da Conta
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>Tipo</label>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem', color: '#1e293b' }}>
                      {selectedUser.role === 'user' ? 'Cliente' : 
                       selectedUser.role === 'admin' ? 'Administrador' : 
                       selectedUser.role === 'reseller' ? 'Revenda' : 'Colaborador'}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>Status</label>
                    <p style={{ 
                      margin: '0.25rem 0 0 0', 
                      fontSize: '1rem', 
                      color: selectedUser.status === 'active' ? '#16a34a' : 
                             selectedUser.status === 'inactive' ? '#f59e0b' : '#ef4444'
                    }}>
                      {selectedUser.status === 'active' ? 'Ativo' : 
                       selectedUser.status === 'inactive' ? 'Inativo' : 'Suspenso'}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>Créditos</label>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem', color: '#1e293b', fontWeight: '600' }}>
                      R$ {selectedUser.credits.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>Plano</label>
                    <p style={{ 
                      margin: '0.25rem 0 0 0', 
                      fontSize: '1rem', 
                      color: getPlanColor(selectedUser.planName || 'Sem plano'),
                      fontWeight: '600'
                    }}>
                      {selectedUser.planName || 'Sem plano'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer do Modal */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '2rem',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(0, 0, 0, 0.1)'
              }}
            >
              <button
                onClick={closeViewUserModal}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#64748b'
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Usuário */}
      {showEditUserModal && selectedUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeEditUserModal();
            }
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1rem',
              padding: '2rem',
              width: '100%',
              maxWidth: '700px',
              maxHeight: '90vh',
              overflow: 'auto',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            {/* Header do Modal */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '2rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '0.75rem',
                    border: '1px solid #dcfce7'
                  }}
                >
                  <Edit style={{ width: '1.5rem', height: '1.5rem', color: '#16a34a' }} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                    Editar Usuário
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                    Altere as informações do usuário
                  </p>
                </div>
              </div>
              <button
                onClick={closeEditUserModal}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X style={{ width: '1.5rem', height: '1.5rem' }} />
              </button>
            </div>

            {/* Formulário de Edição */}
            <form onSubmit={handleUpdateUser}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Primeira linha: Nome e Email */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1.5rem'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Email *
                    </label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Segunda linha: Empresa e Telefone */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1.5rem'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Empresa
                    </label>
                    <input
                      type="text"
                      value={newUser.company || ''}
                      onChange={(e) => setNewUser({ ...newUser, company: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Telefone
                    </label>
                    <input
                      type="tel"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Terceira linha: Status (ocupando metade da largura) */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1.5rem'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Status *
                    </label>
                    <select
                      value={newUser.status}
                      onChange={(e) => setNewUser({ ...newUser, status: e.target.value as 'active' | 'inactive' | 'suspended' })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                      <option value="suspended">Suspenso</option>
                    </select>
                  </div>
                  <div></div> {/* Espaço vazio para manter o grid */}
                </div>
              </div>

              {/* Footer do Modal */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '2rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(0, 0, 0, 0.1)'
                }}
              >
                <button
                  type="button"
                  onClick={closeEditUserModal}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#64748b'
                  }}
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: 'white',
                    opacity: isLoading ? 0.7 : 1
                  }}
                >
                  {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Renovar Plano */}
      {showRenewPlanModal && selectedUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            padding: '0.5rem'
          }}
          onClick={closeRenewPlanModal}
        >
          <div
            className="modal-renovar-plano"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: 'calc(100% - 2rem)',
              maxWidth: '380px',
              maxHeight: '85vh',
              overflow: 'hidden',
              margin: '1rem',
              minWidth: '280px',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`
              .modal-renovar-plano * {
                box-sizing: border-box !important;
              }
              .modal-renovar-plano input,
              .modal-renovar-plano select,
              .modal-renovar-plano textarea {
                max-width: 100% !important;
                width: 100% !important;
              }
            `}</style>
            {/* Header do Modal */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0
              }}
            >
              <h2 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flex: 1,
                minWidth: 0
              }}>
                <Settings style={{ width: '1.25rem', height: '1.25rem', color: '#3b82f6' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Renovar Plano - {selectedUser.name}
                </span>
              </h2>
              <button
                onClick={closeRenewPlanModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0.25rem',
                  borderRadius: '0.375rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#1e293b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRenewPlanSubmit();
              }}
              style={{ 
                padding: '1rem', 
                flex: 1, 
                minHeight: 0, 
                overflowY: 'auto',
                maxHeight: 'calc(90vh - 80px)',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Plano *
                  </label>
                  <select
                    value={planData.planId}
                    onChange={(e) => updateValidityFromPlan(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: 'rgba(249, 250, 251, 0.8)',
                      color: '#6b7280',
                      cursor: 'not-allowed'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">Selecione um plano</option>
                    {availablePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - R$ {plan.price?.toFixed(2)} (Até {plan.maxAgents} agentes)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Validade (dias) *
                  </label>
                  <input
                    type="number"
                    value={planData.validityDays}
                    readOnly
                    min="1"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: 'rgba(249, 250, 251, 0.8)',
                      color: '#6b7280',
                      cursor: 'not-allowed'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Observação
                  </label>
                  <textarea
                    value={planData.note}
                    onChange={(e) => setPlanData({ ...planData, note: e.target.value })}
                    rows={3}
                    placeholder="Observações sobre a renovação do plano..."
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      resize: 'vertical',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Footer do Modal */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '2rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(0, 0, 0, 0.1)'
                }}
              >
                <button
                  type="button"
                  onClick={closeRenewPlanModal}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: 'white',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(59, 130, 246, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <Settings style={{ width: '1rem', height: '1rem' }} />
                  {isLoading ? 'Renovando...' : 'Renovar Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && userToDelete && (
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
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                backgroundColor: '#fef2f2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertTriangle style={{ width: '1.5rem', height: '1.5rem', color: '#ef4444' }} />
              </div>
              <div>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  margin: 0
                }}>Confirmar Exclusão</h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#64748b',
                  margin: '0.25rem 0 0 0'
                }}>Esta ação não pode ser desfeita</p>
              </div>
            </div>
            
            <p style={{
              fontSize: '0.875rem',
              color: '#374151',
              marginBottom: '1.5rem',
              lineHeight: '1.5'
            }}>
              Tem certeza que deseja excluir o usuário <strong>{userToDelete.name}</strong>?
              Todos os dados associados serão permanentemente removidos.
            </p>
            
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                disabled={isLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#64748b',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteUser}
                disabled={isLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'white',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {isLoading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Vincular Plano */}
      {showLinkPlanModal && selectedUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            padding: '1rem'
          }}
          onClick={closeLinkPlanModal}
        >
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div
              style={{
                padding: '1.5rem 1.5rem 0 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <h2 style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Plus style={{ width: '1.5rem', height: '1.5rem', color: '#10b981' }} />
                Vincular Plano - {selectedUser.name}
              </h2>
              <button
                onClick={closeLinkPlanModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0.25rem',
                  borderRadius: '0.375rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#1e293b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLinkPlanSubmit();
              }}
              style={{ padding: '1.5rem' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Plano *
                  </label>
                  <select
                    value={planData.planId}
                    onChange={(e) => updateValidityFromPlan(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: 'rgba(249, 250, 251, 0.8)',
                      color: '#6b7280',
                      cursor: 'not-allowed'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">Selecione um plano</option>
                    {availablePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - R$ {plan.price?.toFixed(2)} (Até {plan.maxAgents} agentes)
                      </option>
                    ))}
                  </select>
                  {planData.planId && (
                    <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                      {(() => {
                        const selectedPlan = availablePlans.find(p => p.id === planData.planId);
                        return selectedPlan ? (
                          <div style={{ fontSize: '0.875rem', color: '#166534' }}>
                            <strong>Detalhes do Plano:</strong><br />
                            • Valor: R$ {selectedPlan.price?.toFixed(2)}<br />
                            • Máximo de Agentes: {selectedPlan.maxAgents}<br />
                            • Período: {selectedPlan.periodDays} dias
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Validade (dias) *
                  </label>
                  <input
                    type="number"
                    value={planData.validityDays}
                    readOnly
                    min="1"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: 'rgba(249, 250, 251, 0.8)',
                      color: '#6b7280',
                      cursor: 'not-allowed'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Observação
                  </label>
                  <textarea
                    value={planData.note}
                    onChange={(e) => setPlanData({ ...planData, note: e.target.value })}
                    rows={3}
                    placeholder="Observações sobre a vinculação do plano..."
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      resize: 'vertical',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Footer do Modal */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '2rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(0, 0, 0, 0.1)'
                }}
              >
                <button
                  type="button"
                  onClick={closeLinkPlanModal}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: 'white',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <Plus style={{ width: '1rem', height: '1rem' }} />
                  {isLoading ? 'Vinculando...' : 'Vincular Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Exclusão em Lote */}
      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        count={selectedUsers.size}
        loading={isDeletingBulk}
        confirmText={bulkDeleteConfirmText}
        onChangeConfirmText={setBulkDeleteConfirmText}
        onCancel={() => { setShowBulkDeleteModal(false); setBulkDeleteConfirmText(''); }}
        onConfirm={confirmBulkDelete}
      />
    </MainLayout>
  );
}
