/**
 * SMS SEND SERVICE - Serviço para envio de SMS personalizado
 */

const axios = require('axios');
const { Pool } = require('pg');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

class SMSSendService {
  constructor() {
    this.apiKey = process.env.SEVEN_API_KEY;
    this.apiUrl = 'https://gateway.seven.io/api/sms';
    this.senderName = 'MinhaSIP';
    
    // Pool de conexão PostgreSQL (reutilizar configuração existente)
    this.pool = new Pool({
      host: process.env.POST_HOST,
      port: parseInt(process.env.POST_PORT || '5432'),
      database: process.env.POST_DATABASE,
      user: process.env.POST_USER,
      password: process.env.POST_PASSWORD,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      ssl: (process.env.POST_SSL || 'false').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false
    });

    this.pool.on('error', (err) => {
      console.error('❌ [SMS SEND] Erro no pool PostgreSQL:', err.message);
    });
  }

  /**
   * Formatar número para E.164 (internacional)
   * Converte (19) 99565-2552 para +5519995652552
   */
  formatPhoneNumber(phone) {
    // Remove todos os caracteres não numéricos
    const digits = phone.replace(/\D/g, '');
    
    // Se começar com 0, remove o 0 inicial
    let cleanDigits = digits.startsWith('0') ? digits.substring(1) : digits;
    
    // Se já tem código do país +55, apenas adiciona o +
    if (cleanDigits.startsWith('55') && cleanDigits.length >= 12) {
      return `+${cleanDigits}`;
    }
    
    // Casos brasileiros comuns:
    // 11 dígitos: 11999887766 (DDD + 9 + 8 dígitos)
    // 10 dígitos: 1199887766 (DDD + 8 dígitos - fixo)
    if (cleanDigits.length === 11 || cleanDigits.length === 10) {
      return `+55${cleanDigits}`;
    }
    
    // Se tem 9 dígitos, pode ser celular sem DDD (adiciona DDD padrão 11)
    if (cleanDigits.length === 9 && cleanDigits.startsWith('9')) {
      return `+5511${cleanDigits}`;
    }
    
    // Se tem 8 dígitos, pode ser fixo sem DDD (adiciona DDD padrão 11)
    if (cleanDigits.length === 8) {
      return `+5511${cleanDigits}`;
    }
    
    // Se não conseguir identificar o padrão, adiciona +55 na frente
    return `+55${cleanDigits}`;
  }

  /**
   * Verificar se a tabela existe
   */
  async ensureTable() {
    try {
      const result = await this.pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'sms_send_pabx'
        )`
      );
      
      if (!result.rows[0].exists) {
        console.warn('⚠️ [SMS SEND] Tabela sms_send_pabx não encontrada');
        console.warn('⚠️ [SMS SEND] Certifique-se de que a tabela foi criada no banco');
      }
    } catch (error) {
      console.error('❌ [SMS SEND] Erro ao verificar tabela:', error.message);
    }
  }

  /**
   * Enviar SMS via seven.io
   */
  async sendSMSToProvider(phone, content) {
    if (!this.apiKey) {
      throw new Error('SEVEN_API_KEY não configurada no .env');
    }

    const formattedPhone = this.formatPhoneNumber(phone);

    const formData = new URLSearchParams({
      to: formattedPhone,
      text: content,
      from: this.senderName
    });

    try {
      console.log(`📤 [SMS SEND] Enviando para ${formattedPhone}...`);
      
      const response = await axios.post(this.apiUrl, formData.toString(), {
        headers: {
          'X-Api-Key': this.apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 20000,
        validateStatus: () => true // Não lançar erro para status HTTP
      });

      console.log(`📱 [SMS SEND] Status: ${response.status} | Resposta:`, response.data);

      // Verificar se foi enviado com sucesso
      if (response.status === 200) {
        try {
          const responseData = typeof response.data === 'string' 
            ? JSON.parse(response.data) 
            : response.data;
          
          // seven.io retorna success: true quando enviado
          if (responseData.success === true || response.data.includes('100')) {
            return { success: true, data: responseData };
          }
        } catch (parseError) {
          // Se não conseguir parsear, mas status 200, considerar sucesso
          if (response.status === 200) {
            return { success: true, data: response.data };
          }
        }
      }

      return { 
        success: false, 
        error: `Erro no envio: ${response.status} - ${response.data}` 
      };

    } catch (error) {
      console.error('❌ [SMS SEND] Erro ao enviar:', error.message);
      return { 
        success: false, 
        error: `Falha na comunicação: ${error.message}` 
      };
    }
  }

  /**
   * Enviar SMS personalizado
   */
  async sendSMS(userid, agent_id, content, destination, ipAddress = null, userAgent = null) {
    try {
      await this.ensureTable();

      const formattedDestination = this.formatPhoneNumber(destination);

      // Salvar no banco com status 'queued'
      const result = await this.pool.query(
        `INSERT INTO sms_send_pabx (userid, agent_id, content, destination, status)
         VALUES ($1, $2, $3, $4, 'queued')
         RETURNING id`,
        [userid, agent_id, content, formattedDestination]
      );

      const smsId = result.rows[0].id;

      // Enviar SMS
      const smsResult = await this.sendSMSToProvider(formattedDestination, content);

      if (smsResult.success) {
        // Atualizar status para 'sent'
        await this.pool.query(
          'UPDATE sms_send_pabx SET status = $1 WHERE id = $2',
          ['sent', smsId]
        );

        console.log(`✅ [SMS SEND] SMS enviado para ${formattedDestination} (ID: ${smsId})`);
        return {
          success: true,
          message: 'SMS enviado com sucesso',
          sms_id: smsId,
          destination: formattedDestination
        };
      } else {
        // Atualizar status para 'failed'
        await this.pool.query(
          'UPDATE sms_send_pabx SET status = $1 WHERE id = $2',
          ['failed', smsId]
        );

        return {
          success: false,
          error: smsResult.error || 'Erro ao enviar SMS'
        };
      }

    } catch (error) {
      console.error('❌ [SMS SEND] Erro ao enviar SMS:', error.message);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  /**
   * Buscar status de um SMS específico
   */
  async getSMSStatus(smsId) {
    try {
      const result = await this.pool.query(
        `SELECT id, userid, agent_id, content, destination, status, black, created_at
         FROM sms_send_pabx 
         WHERE id = $1`,
        [smsId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('❌ [SMS SEND] Erro ao buscar status:', error.message);
      return null;
    }
  }

  /**
   * Buscar histórico de SMS de um usuário
   */
  async getUserSMSHistory(userid, limit = 50, offset = 0) {
    try {
      const result = await this.pool.query(
        `SELECT id, agent_id, content, destination, status, black, created_at
         FROM sms_send_pabx 
         WHERE userid = $1 AND black = false
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userid, limit, offset]
      );

      return result.rows;
    } catch (error) {
      console.error('❌ [SMS SEND] Erro ao buscar histórico do usuário:', error.message);
      return [];
    }
  }

  /**
   * Buscar histórico de SMS de um agente
   */
  async getAgentSMSHistory(agentId, limit = 50, offset = 0) {
    try {
      const result = await this.pool.query(
        `SELECT id, userid, content, destination, status, black, created_at
         FROM sms_send_pabx 
         WHERE agent_id = $1 AND black = false
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [agentId, limit, offset]
      );

      return result.rows;
    } catch (error) {
      console.error('❌ [SMS SEND] Erro ao buscar histórico do agente:', error.message);
      return [];
    }
  }

  /**
   * Marcar SMS como blacklisted
   */
  async blacklistSMS(smsId) {
    try {
      const result = await this.pool.query(
        'UPDATE sms_send_pabx SET black = true WHERE id = $1',
        [smsId]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error('❌ [SMS SEND] Erro ao blacklistar SMS:', error.message);
      return false;
    }
  }

  /**
   * Fechar conexões do pool
   */
  async close() {
    try {
      await this.pool.end();
      console.log('👋 [SMS SEND] Pool de conexões fechado');
    } catch (error) {
      console.error('❌ [SMS SEND] Erro ao fechar pool:', error.message);
    }
  }

  /**
   * Validar mensagem contra palavras/frases bloqueadas na tabela text_block
   * @param {string} content - Conteúdo da mensagem
   * @returns {Object} - { success: boolean, blockedPhrase?: string }
   */
  async validateMessage(content) {
    try {
      if (!content || typeof content !== 'string') {
        return { success: false, error: 'Conteúdo inválido' };
      }

      // Buscar todas as palavras/frases bloqueadas
      const query = 'SELECT text FROM text_block WHERE text IS NOT NULL AND text != \'\'';
      const result = await this.pool.query(query);
      
      if (result.rows.length === 0) {
        return { success: true };
      }

      // Converter mensagem para minúsculo para comparação case-insensitive
      const contentLower = content.toLowerCase();

      // Verificar cada palavra/frase bloqueada
      for (const row of result.rows) {
        const blockedText = row.text.toLowerCase();
        
        // Verificar se a palavra/frase bloqueada está contida na mensagem
        if (contentLower.includes(blockedText)) {
          console.log(`🚫 [SMS SEND] Mensagem bloqueada - contém: "${row.text}"`);
          return { 
            success: false, 
            blockedPhrase: row.text 
          };
        }
      }

      console.log('✅ [SMS SEND] Mensagem aprovada na validação');
      return { success: true };

    } catch (error) {
      console.error('❌ [SMS SEND] Erro ao validar mensagem:', error);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const smsSendService = new SMSSendService();

module.exports = smsSendService;
