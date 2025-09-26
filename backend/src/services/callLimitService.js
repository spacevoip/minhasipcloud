const { query } = require('../config/database');

/**
 * Serviço para controle de limite de chamadas em planos de teste
 * Monitora CDR e suspende usuários quando atingem max_concurrent_calls
 */
class CallLimitService {
  
  /**
   * Verifica e aplica limite de chamadas para usuários com planos plan_test=TRUE
   * @param {string} userId - ID do usuário que fez a chamada
   */
  async checkAndApplyCallLimit(userId) {
    try {
      console.log(`🔍 [CallLimit] Verificando limite para usuário: ${userId}`);
      
      // 1. Buscar informações do plano do usuário
      const planResult = await query(`
        SELECT 
          u.id as user_id,
          u.status as user_status,
          p.id as plan_id,
          p.name as plan_name,
          p.plan_test,
          p.max_concurrent_calls
        FROM users_pabx u
        LEFT JOIN planos_pabx p ON u.plan_id = p.id
        WHERE u.id = $1
      `, [userId]);

      if (!planResult.rows.length) {
        console.log(`⚠️ [CallLimit] Usuário ${userId} não encontrado`);
        return;
      }

      const user = planResult.rows[0];
      
      // 2. Verificar se o plano tem controle de teste ativo
      if (!user.plan_test) {
        console.log(`ℹ️ [CallLimit] Usuário ${userId} não tem plano de teste, ignorando limite`);
        return;
      }

      if (!user.max_concurrent_calls || user.max_concurrent_calls <= 0) {
        console.log(`⚠️ [CallLimit] Plano ${user.plan_name} não tem limite configurado`);
        return;
      }

      console.log(`📋 [CallLimit] Usuário ${userId} - Plano: ${user.plan_name} (Limite: ${user.max_concurrent_calls})`);

      // 3. Contar chamadas do usuário no CDR
      const callCount = await this.getUserCallCount(userId);
      
      console.log(`📞 [CallLimit] Usuário ${userId} - Chamadas realizadas: ${callCount}/${user.max_concurrent_calls}`);

      // 4. Verificar se atingiu o limite
      if (callCount >= user.max_concurrent_calls) {
        console.log(`🚫 [CallLimit] LIMITE ATINGIDO! Suspendendo usuário ${userId}`);
        await this.suspendUser(userId, user.plan_name, callCount, user.max_concurrent_calls);
        return true; // Usuário foi suspenso
      }

      return false; // Usuário ainda não atingiu o limite
      
    } catch (error) {
      console.error(`❌ [CallLimit] Erro ao verificar limite para usuário ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Conta o número de chamadas do usuário no CDR
   * @param {string} userId - ID do usuário
   * @returns {number} Número de chamadas
   */
  async getUserCallCount(userId) {
    try {
      // Determinar tabela CDR (usar mesma lógica do cdr.js)
      const cdrTable = process.env.CDR_TABLE || 'cdr_pabx';
      
      const result = await query(`
        SELECT COUNT(*) as call_count
        FROM ${cdrTable}
        WHERE accountcode = $1
      `, [userId]);

      return parseInt(result.rows[0]?.call_count || 0);
      
    } catch (error) {
      console.error(`❌ [CallLimit] Erro ao contar chamadas do usuário ${userId}:`, error);
      
      // Fallback: tentar tabela alternativa
      try {
        const fallbackResult = await query(`
          SELECT COUNT(*) as call_count
          FROM cdr
          WHERE accountcode = $1
        `, [userId]);
        
        return parseInt(fallbackResult.rows[0]?.call_count || 0);
      } catch (fallbackError) {
        console.error(`❌ [CallLimit] Erro no fallback CDR:`, fallbackError);
        return 0;
      }
    }
  }

  /**
   * Suspende o usuário por atingir limite de chamadas
   * @param {string} userId - ID do usuário
   * @param {string} planName - Nome do plano
   * @param {number} callCount - Número de chamadas realizadas
   * @param {number} limit - Limite do plano
   */
  async suspendUser(userId, planName, callCount, limit) {
    try {
      // Atualizar status do usuário para 'suspended'
      await query(`
        UPDATE users_pabx 
        SET 
          status = 'suspended',
          updated_at = NOW()
        WHERE id = $1
      `, [userId]);

      console.log(`✅ [CallLimit] Usuário ${userId} suspenso com sucesso`);
      
      // Log da suspensão para auditoria
      console.log(`📋 [CallLimit] SUSPENSÃO AUTOMÁTICA:
        - Usuário: ${userId}
        - Plano: ${planName}
        - Chamadas: ${callCount}/${limit}
        - Data: ${new Date().toISOString()}
      `);

    } catch (error) {
      console.error(`❌ [CallLimit] Erro ao suspender usuário ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Verifica todos os usuários com planos de teste e aplica limites
   * Método para execução em batch/cron
   */
  async checkAllTestPlanUsers() {
    try {
      console.log(`🔄 [CallLimit] Iniciando verificação em lote de usuários com planos de teste`);
      
      // Buscar todos os usuários com planos de teste ativos
      const usersResult = await query(`
        SELECT 
          u.id as user_id,
          u.status as user_status,
          p.name as plan_name,
          p.max_concurrent_calls
        FROM users_pabx u
        INNER JOIN planos_pabx p ON u.plan_id = p.id
        WHERE p.plan_test = TRUE 
        AND p.max_concurrent_calls > 0
        AND u.status != 'suspended'
        ORDER BY u.created_at DESC
      `);

      const users = usersResult.rows;
      console.log(`📊 [CallLimit] Encontrados ${users.length} usuários com planos de teste para verificar`);

      let suspendedCount = 0;
      
      for (const user of users) {
        try {
          const wasSuspended = await this.checkAndApplyCallLimit(user.user_id);
          if (wasSuspended) {
            suspendedCount++;
          }
          
          // Pequena pausa entre verificações para não sobrecarregar o banco
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ [CallLimit] Erro ao verificar usuário ${user.user_id}:`, error);
        }
      }

      console.log(`✅ [CallLimit] Verificação concluída. ${suspendedCount} usuários suspensos de ${users.length} verificados`);
      
      return {
        totalChecked: users.length,
        suspended: suspendedCount
      };
      
    } catch (error) {
      console.error(`❌ [CallLimit] Erro na verificação em lote:`, error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de uso de planos de teste
   */
  async getTestPlanStats() {
    try {
      const result = await query(`
        SELECT 
          p.name as plan_name,
          p.max_concurrent_calls as call_limit,
          COUNT(u.id) as total_users,
          COUNT(CASE WHEN u.status = 'suspended' THEN 1 END) as suspended_users,
          COUNT(CASE WHEN u.status = 'active' THEN 1 END) as active_users
        FROM planos_pabx p
        LEFT JOIN users_pabx u ON u.plan_id = p.id
        WHERE p.plan_test = TRUE
        GROUP BY p.id, p.name, p.max_concurrent_calls
        ORDER BY p.name
      `);

      return result.rows.map(row => ({
        planName: row.plan_name,
        callLimit: parseInt(row.call_limit) || 0,
        totalUsers: parseInt(row.total_users) || 0,
        suspendedUsers: parseInt(row.suspended_users) || 0,
        activeUsers: parseInt(row.active_users) || 0
      }));
      
    } catch (error) {
      console.error(`❌ [CallLimit] Erro ao obter estatísticas:`, error);
      throw error;
    }
  }
}

module.exports = new CallLimitService();
