// =====================================================
// USER REALTIME SERVICE - Monitora status do usuário em tempo real
// =====================================================

import supabase from '@/lib/supabase';
import { logger } from '@/lib/logger';

export type OnSuspendedCallback = () => void;

class UserRealtimeService {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private currentUserId: string | null = null;
  private onSuspended: OnSuspendedCallback | null = null;

  start(userId: string, onSuspended: OnSuspendedCallback) {
    try {
      if (typeof window === 'undefined') return;

      // Evita duplicar
      if (this.currentUserId === userId && this.channel) return;

      this.stop();

      this.currentUserId = userId;
      this.onSuspended = onSuspended;

      this.channel = supabase
        .channel(`user-status-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users_pabx',
            filter: `id=eq.${userId}`,
          },
          (payload: any) => {
            try {
              const newStatus = payload?.new?.status as string | undefined;
              if (newStatus === 'suspended') {
                logger.warn('🚫 Usuário suspenso detectado via Realtime. Forçando logout.');
                this.onSuspended?.();
              }
            } catch (err) {
              logger.error('Erro no handler Realtime user-status:', err);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            logger.info('🟢 Realtime user-status inscrito');
          } else {
            logger.info('ℹ️ Canal user-status estado:', status);
          }
        });
    } catch (error) {
      logger.error('Erro ao iniciar UserRealtimeService:', error);
    }
  }

  stop() {
    try {
      if (this.channel) {
        try {
          this.channel.unsubscribe();
        } catch {}
      }
    } finally {
      this.channel = null;
      this.currentUserId = null;
      this.onSuspended = null;
    }
  }
}

export const userRealtimeService = new UserRealtimeService();
