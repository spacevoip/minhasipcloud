/**
 * =====================================================
 * AGENTS REALTIME SERVICE
 * =====================================================
 * Sistema híbrido: Realtime do Supabase + Fallback polling
 * - Principal: Realtime da tabela agentes_pabx (status_sip, last_seen)
 * - Fallback: extensionStatusService a cada 10 minutos
 * - Ativação condicional apenas em páginas que precisam
 */

import { supabase } from '@/lib/supabase';
import { extensionStatusService } from './extensionStatusService';
import { logger } from '@/lib/logger';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface AgentRealtimeStatus {
  id: string;
  ramal: string;
  agente_name: string;
  status_sip: 'online' | 'offline' | 'busy' | 'away';
  last_seen: string;
  user_id: string;
  updated_at: string;
}

export interface AgentStatusUpdate {
  agentId: string;
  ramal: string;
  name: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  lastSeen: string;
  isRealtime: boolean; // true = realtime, false = fallback
}

class AgentsRealtimeService {
  private channel: RealtimeChannel | null = null;
  private fallbackInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(update: AgentStatusUpdate) => void> = new Set();
  private currentUserAgents: Set<string> = new Set(); // ramais do usuário atual
  private isActive = false;
  private currentUserId: string | null = null;

  /**
   * Iniciar sistema híbrido para ramais específicos
   */
  async startRealtimeForAgents(agentRamais: string[], userId: string) {
    if (this.isActive && this.currentUserId === userId) {
      // Atualizar lista de ramais monitorados e carregar status inicial dos novos
      this.currentUserAgents = new Set(agentRamais);
      await this.loadInitialStatus(agentRamais);
      return;
    }

    this.currentUserId = userId;
    this.currentUserAgents = new Set(agentRamais);
    this.isActive = true;

    logger.info(`🔴 Iniciando realtime para ${agentRamais.length} ramais:`, agentRamais);

    // 1. Carregamento inicial em lote (fallback)
    await this.loadInitialStatus(agentRamais);

    // 2. Iniciar realtime do Supabase
    this.startSupabaseRealtime(userId);

    // 3. Iniciar fallback a cada 10 minutos
    this.startFallbackPolling();
  }

  /**
   * Parar sistema híbrido
   */
  stopRealtime() {
    if (!this.isActive) return;

    logger.info('🔴 Parando sistema realtime');

    // Parar realtime do Supabase
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    // Parar fallback polling
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }

    // Limpar estado
    this.isActive = false;
    this.currentUserId = null;
    this.currentUserAgents.clear();
    this.listeners.clear();
  }

  /**
   * Carregar status inicial diretamente do Supabase
   */
  private async loadInitialStatus(ramais: string[]) {
    try {
      logger.info('📊 Carregando status inicial do Supabase...');
      
      // Buscar dados diretamente do Supabase
      const { data, error } = await supabase
        .from('agentes_pabx')
        .select('id, ramal, agente_name, status_sip, last_seen')
        .eq('user_id', this.currentUserId)
        .in('ramal', ramais);

      if (error) {
        logger.error('❌ Erro ao carregar do Supabase:', error);
        return;
      }

      logger.info(`✅ ${data.length} agentes carregados do Supabase`);
      
      // Converter e notificar listeners
      data.forEach(agent => {
        const update: AgentStatusUpdate = {
          agentId: agent.id,
          ramal: agent.ramal,
          name: agent.agente_name,
          status: agent.status_sip || 'offline',
          lastSeen: agent.last_seen,
          isRealtime: false // carregamento inicial
        };
        
        logger.info(`📊 Carregando inicial: ${agent.ramal} → ${agent.status_sip}`);
        this.notifyListeners(update);
      });

    } catch (error) {
      logger.error('❌ Erro no carregamento inicial:', error);
    }
  }

  /**
   * Iniciar realtime do Supabase na tabela agentes_pabx
   */
  private startSupabaseRealtime(userId: string) {
    try {
      // Criar canal específico para o usuário
      this.channel = supabase
        .channel(`agents-realtime-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'agentes_pabx',
            filter: `user_id=eq.${userId}` // Apenas agentes do usuário
          },
          (payload) => this.handleRealtimeUpdate(payload)
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            logger.info('✅ Realtime Supabase conectado para agentes');
          } else if (status === 'CHANNEL_ERROR') {
            logger.error('❌ Erro no canal realtime');
          }
        });

    } catch (error) {
      logger.error('❌ Erro ao iniciar realtime Supabase:', error);
    }
  }

  /**
   * Processar atualização realtime do Supabase
   */
  private handleRealtimeUpdate(payload: any) {
    try {
      const newRecord = payload.new as AgentRealtimeStatus;
      
      // Verificar se é um ramal que estamos monitorando
      if (!this.currentUserAgents.has(newRecord.ramal)) {
        logger.info(`🔴 Ignorando update para ramal não monitorado: ${newRecord.ramal}`);
        return;
      }

      logger.info(`🔴 Realtime UPDATE recebido: ${newRecord.ramal} → ${newRecord.status_sip}`);
      logger.info(`🔴 Payload completo:`, JSON.stringify(payload, null, 2));

      // Criar update e notificar
      const update: AgentStatusUpdate = {
        agentId: newRecord.id,
        ramal: newRecord.ramal,
        name: newRecord.agente_name,
        status: newRecord.status_sip,
        lastSeen: newRecord.last_seen,
        isRealtime: true // realtime
      };

      logger.info(`🔴 Notificando ${this.listeners.size} listeners com update:`, update);
      this.notifyListeners(update);

    } catch (error) {
      logger.error('❌ Erro ao processar update realtime:', error);
    }
  }

  /**
   * Iniciar fallback polling a cada 10 minutos
   */
  private startFallbackPolling() {
    // Primeira execução após 10 minutos
    this.fallbackInterval = setInterval(async () => {
      if (!this.isActive || this.currentUserAgents.size === 0) {
        return;
      }

      try {
        logger.info('🔄 Executando fallback polling (10min)...');
        
        const ramais = Array.from(this.currentUserAgents);
        const batchStatus = await extensionStatusService.getBatchExtensionStatus(ramais);
        
        // Notificar apenas se houver mudanças
        Object.values(batchStatus).forEach(status => {
          const update: AgentStatusUpdate = {
            agentId: status.agentId,
            ramal: status.extension,
            name: status.name,
            status: status.status,
            lastSeen: status.lastChecked,
            isRealtime: false // fallback
          };
          
          this.notifyListeners(update);
        });

        logger.info('✅ Fallback polling executado');
      } catch (error) {
        logger.error('❌ Erro no fallback polling:', error);
      }
    }, 10 * 60 * 1000); // 10 minutos
  }

  /**
   * Notificar todos os listeners
   */
  private notifyListeners(update: AgentStatusUpdate) {
    this.listeners.forEach(listener => {
      try {
        listener(update);
      } catch (error) {
        logger.error('❌ Erro no listener:', error);
      }
    });
  }

  /**
   * Adicionar listener para updates
   */
  addListener(listener: (update: AgentStatusUpdate) => void) {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Remover listener
   */
  removeListener(listener: (update: AgentStatusUpdate) => void) {
    this.listeners.delete(listener);
  }

  /**
   * Verificar se está ativo
   */
  isRealtimeActive(): boolean {
    return this.isActive;
  }

  /**
   * Obter ramais monitorados
   */
  getMonitoredAgents(): string[] {
    return Array.from(this.currentUserAgents);
  }

  /**
   * Atualizar lista de ramais monitorados (para paginação)
   */
  updateMonitoredAgents(ramais: string[]) {
    if (!this.isActive) return;
    
    this.currentUserAgents = new Set(ramais);
    logger.info(`🔄 Ramais monitorados atualizados: ${ramais.length}`);
  }

  /**
   * Verificar se deve ativar realtime baseado na página
   */
  shouldActivateRealtime(pageContext?: string): boolean {
    if (typeof window === 'undefined') return false;
    
    const currentPath = window.location.pathname;
    const context = pageContext || currentPath;
    
    // Páginas que PRECISAM de realtime de agentes
    const realtimePages = [
      '/agents',
      '/admin/agents-all',
      '/admin/real-time-calls'
    ];
    
    return realtimePages.some(page => context.includes(page));
  }
}

// Instância singleton
export const agentsRealtimeService = new AgentsRealtimeService();
