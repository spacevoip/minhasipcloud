/**
 * SMS SERVICE - Integração com seven.io para validação de números móveis
 */

const axios = require('axios');
const { Pool } = require('pg');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

class SMSService {
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
      console.error('❌ [SMS] Erro no pool PostgreSQL:', err.message);
    });
  }

  /**
   * Gerar código aleatório de 6 dígitos
   */
  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
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
   * Verificar se a tabela existe (não cria, apenas verifica)
   */
  async ensureTable() {
    try {
      // Apenas verifica se a tabela existe
      const result = await this.pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'otp_pabx'
        )`
      );
      
      if (!result.rows[0].exists) {
        console.warn('⚠️ [SMS] Tabela otp_pabx não encontrada');
        console.warn('⚠️ [SMS] Certifique-se de que a tabela foi criada no banco');
      }
    } catch (error) {
      console.error('❌ [SMS] Erro ao verificar tabela:', error.message);
      // Não lança erro, apenas avisa
    }
  }

  /**
   * Limpar códigos expirados (marcar valido = false)
   */
  async cleanExpiredCodes() {
    try {
      const result = await this.pool.query(
        'UPDATE otp_pabx SET valido = false WHERE send_expirat < NOW() AND valido = true'
      );
      
      if (result.rowCount > 0) {
        console.log(`🧹 [SMS] Marcados ${result.rowCount} códigos como expirados`);
      }
    } catch (error) {
      console.error('❌ [SMS] Erro ao marcar códigos expirados:', error.message);
    }
  }

  /**
   * Verificar rate limiting (máximo 3 SMS por telefone em 10 minutos)
   */
  async checkRateLimit(phone) {
    try {
      const result = await this.pool.query(
        `SELECT COUNT(*) as count 
         FROM otp_pabx 
         WHERE phone = $1 AND send_date > NOW() - INTERVAL '10 minutes'`,
        [phone]
      );

      const count = parseInt(result.rows[0].count);
      return count < 3; // Máximo 3 tentativas em 10 minutos
    } catch (error) {
      console.error('❌ [SMS] Erro ao verificar rate limit:', error.message);
      return false;
    }
  }

  /**
   * Enviar código SMS via seven.io
   */
  async sendSMS(phone, code) {
    if (!this.apiKey) {
      throw new Error('SEVEN_API_KEY não configurada no .env');
    }

    const formattedPhone = this.formatPhoneNumber(phone);
    const message = `MinhaSIP: Seu código de autenticação é: ${code}\nEle expira em 5 minutos. Não compartilhe com ninguém.`;

    const formData = new URLSearchParams({
      to: formattedPhone,
      text: message,
      from: this.senderName
    });

    try {
      console.log(`📤 [SMS] Enviando para ${formattedPhone}...`);
      
      const response = await axios.post(this.apiUrl, formData.toString(), {
        headers: {
          'X-Api-Key': this.apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 20000,
        validateStatus: () => true // Não lançar erro para status HTTP
      });

      console.log(`📱 [SMS] Status: ${response.status} | Resposta:`, response.data);

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
      console.error('❌ [SMS] Erro ao enviar:', error.message);
      return { 
        success: false, 
        error: `Falha na comunicação: ${error.message}` 
      };
    }
  }

  /**
   * Solicitar código SMS
   */
  async requestCode(phone, ipAddress = null, userAgent = null) {
    try {
      await this.cleanExpiredCodes();

      const formattedPhone = this.formatPhoneNumber(phone);

      // Verificar rate limiting
      const canSend = await this.checkRateLimit(formattedPhone);
      if (!canSend) {
        return {
          success: false,
          error: 'Muitas tentativas. Aguarde 10 minutos antes de solicitar um novo código.'
        };
      }

      // Gerar código
      const code = this.generateCode();

      // Mensagem a ser enviada (também será salva na coluna msg)
      const message = `MinhaSIP: Seu código de autenticação é: ${code}\nEle expira em 5 minutos. Não compartilhe com ninguém.`;

      // Salvar no banco (send_expirat é calculado automaticamente pela tabela)
      await this.pool.query(
        `INSERT INTO otp_pabx (phone, otp, msg)
         VALUES ($1, $2, $3)`,
        [formattedPhone, code, message]
      );

      // Enviar SMS
      const smsResult = await this.sendSMS(formattedPhone, code);

      if (smsResult.success) {
        console.log(`✅ [SMS] Código enviado para ${formattedPhone}`);
        return {
          success: true,
          message: 'Código SMS enviado com sucesso',
          phone: formattedPhone
        };
      } else {
        // Marcar código como inválido se falhou o envio
        await this.pool.query(
          'UPDATE otp_pabx SET valido = false WHERE phone = $1 AND otp = $2',
          [formattedPhone, code]
        );

        return {
          success: false,
          error: smsResult.error || 'Erro ao enviar SMS'
        };
      }

    } catch (error) {
      console.error('❌ [SMS] Erro ao solicitar código:', error.message);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  /**
   * Verificar código SMS
   */
  async verifyCode(phone, code, ipAddress = null) {
    try {
      await this.cleanExpiredCodes();

      const formattedPhone = this.formatPhoneNumber(phone);

      // Buscar código mais recente para o telefone
      const result = await this.pool.query(
        `SELECT id, otp, valido, verificado, send_expirat
         FROM otp_pabx 
         WHERE phone = $1 AND verificado = FALSE
         ORDER BY send_date DESC
         LIMIT 1`,
        [formattedPhone]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Nenhum código encontrado. Solicite um novo código.'
        };
      }

      const record = result.rows[0];

      // Verificar se o código ainda é válido
      if (!record.valido) {
        return {
          success: false,
          error: 'Código expirado. Solicite um novo código.'
        };
      }

      // Verificar se expirou (dupla verificação)
      const now = new Date();
      const expiration = new Date(record.send_expirat);
      if (now > expiration) {
        // Marcar como inválido
        await this.pool.query(
          'UPDATE otp_pabx SET valido = false WHERE id = $1',
          [record.id]
        );
        
        return {
          success: false,
          error: 'Código expirado. Solicite um novo código.'
        };
      }

      // Verificar código
      if (record.otp === code) {
        // Marcar como verificado
        await this.pool.query(
          'UPDATE otp_pabx SET verificado = TRUE WHERE id = $1',
          [record.id]
        );

        console.log(`✅ [SMS] Código verificado para ${formattedPhone}`);
        return {
          success: true,
          message: 'Código verificado com sucesso',
          phone: formattedPhone
        };
      } else {
        return {
          success: false,
          error: 'Código incorreto. Verifique e tente novamente.'
        };
      }

    } catch (error) {
      console.error('❌ [SMS] Erro ao verificar código:', error.message);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  /**
   * Verificar se um telefone foi verificado recentemente (últimas 24h)
   */
  async isPhoneVerified(phone) {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      const result = await this.pool.query(
        `SELECT COUNT(*) as count
         FROM otp_pabx 
         WHERE phone = $1 AND verificado = TRUE AND send_date > NOW() - INTERVAL '24 hours'`,
        [formattedPhone]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('❌ [SMS] Erro ao verificar telefone:', error.message);
      return false;
    }
  }

  /**
   * Fechar conexões do pool
   */
  async close() {
    try {
      await this.pool.end();
      console.log('👋 [SMS] Pool de conexões fechado');
    } catch (error) {
      console.error('❌ [SMS] Erro ao fechar pool:', error.message);
    }
  }
}

// Singleton instance
const smsService = new SMSService();

module.exports = smsService;
