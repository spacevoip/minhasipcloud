const { query, supabase } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  constructor(userData) {
    this.id = userData.id;
    this.username = userData.username;
    this.email = userData.email;
    this.password_hash = userData.password_hash || userData.password; // Suporte para ambos os nomes
    this.name = userData.name;
    this.company = userData.company;
    this.phone = userData.phone;
    this.role = userData.role;
    this.status = userData.status;
    this.credits = userData.credits;
    this.planId = userData.plan_id;
    this.parentResellerId = userData.parent_reseller_id;
    this.maxConcurrentCalls = userData.max_concurrent_calls;
    this.createdBy = userData.created_by;
    this.timezone = userData.timezone;
    this.language = userData.language;
    this.settings = userData.settings;
    this.metadata = userData.metadata;
    this.createdAt = userData.created_at;
    this.updatedAt = userData.updated_at;
    this.lastLoginAt = userData.last_login_at;
    // IP
    this.lastIp = userData.last_ip;
    // Campos de plano
    this.planActivatedAt = userData.plan_activated_at;
    this.planExpiresAt = userData.plan_expires_at;
    this.planStatus = userData.plan_status;
    // Flags e métricas adicionais
    this.webrtc = userData.webrtc;
    this.auto_discagem = userData.auto_discagem;
    this.up_audio = userData.up_audio;
    this.sms_send = userData.sms_send;
    this.mailling_up = userData.mailling_up;
    this.planFree = userData.plan_free;
    this.totalCall = userData.total_call;
  }

  // Buscar usuário por email
  static async findByEmail(email) {
    try {
      // Tentar primeiro com Supabase client
      const { data, error } = await supabase
        .from('users_pabx')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️  Tabela users_pabx não existe ainda');
          return null;
        }
        if (error.code === 'PGRST100') {
          // Nenhum resultado encontrado
          return null;
        }
        throw error;
      }
      
      return data ? new User(data) : null;
    } catch (error) {
      console.error('❌ Erro ao buscar usuário por email:', error);
      
      // Fallback para query SQL direta
      try {
        const result = await query(
          'SELECT * FROM users_pabx WHERE email = $1',
          [email]
        );
        
        if (result.rows.length === 0) {
          return null;
        }
        
        return new User(result.rows[0]);
      } catch (fallbackError) {
        console.error('❌ Erro no fallback SQL:', fallbackError);
        throw error;
      }
    }
  }

  // Buscar usuário por username
  static async findByUsername(username) {
    try {
      // Tentar primeiro com Supabase client
      const { data, error } = await supabase
        .from('users_pabx')
        .select('*')
        .eq('username', username)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️  Tabela users_pabx não existe ainda');
          return null;
        }
        if (error.code === 'PGRST100') {
          // Nenhum resultado encontrado
          return null;
        }
        throw error;
      }
      
      return data ? new User(data) : null;
    } catch (error) {
      console.error('❌ Erro ao buscar usuário por username:', error);
      throw error;
    }
  }

  // Buscar usuário por ID
  static async findById(id) {
    try {
      // Usar Supabase client com logs detalhados para debug
      const { data, error } = await supabase
        .from('users_pabx')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️  Tabela users_pabx não existe ainda');
          return null;
        }
        if (error.code === 'PGRST100') {
          return null;
        }
        throw error;
      }
      
      if (!data) {
        return null;
      }
      
      // Log detalhado dos campos boolean para debug
      console.log(`🔍 [User.findById] Dados do Supabase para ${id}:`, {
        sms_send: data.sms_send,
        sms_send_type: typeof data.sms_send,
        webrtc: data.webrtc,
        webrtc_type: typeof data.webrtc,
        auto_discagem: data.auto_discagem,
        auto_discagem_type: typeof data.auto_discagem,
        up_audio: data.up_audio,
        mailling_up: data.mailling_up
      });
      
      // Garantir que os campos boolean sejam tratados corretamente
      const normalizedData = {
        ...data,
        sms_send: Boolean(data.sms_send),
        webrtc: Boolean(data.webrtc),
        auto_discagem: Boolean(data.auto_discagem),
        up_audio: Boolean(data.up_audio),
        mailling_up: Boolean(data.mailling_up)
      };
      
      console.log(`✅ [User.findById] Dados normalizados:`, {
        sms_send: normalizedData.sms_send,
        webrtc: normalizedData.webrtc,
        auto_discagem: normalizedData.auto_discagem,
        up_audio: normalizedData.up_audio,
        mailling_up: normalizedData.mailling_up
      });
      
      return new User(normalizedData);
      
    } catch (error) {
      console.error('❌ Erro ao buscar usuário por ID:', error);
      throw error;
    }
  }

  // Verificar senha
  static async verifyPassword(login, password) {
    try {
      console.log('🔍 Buscando usuário para login:', login);
      
      // Usar apenas cliente Supabase (mais confiável)
      const { data: users, error } = await supabase
        .from('users_pabx')
        .select('*')
        .or(`email.eq.${login},username.eq.${login}`);
      
      if (error) {
        console.error('❌ Erro no Supabase:', error);
        throw new Error('Erro ao buscar usuário no banco de dados');
      }
      
      if (!users || users.length === 0) {
        console.log('❌ Usuário não encontrado');
        return null;
      }
      
      const user = users[0];
      console.log('✅ Usuário encontrado:', user.name);
      
      // Verificar senha
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        console.log('❌ Senha inválida');
        return null;
      }
      
      console.log('✅ Login válido para:', user.name);
      const userInstance = new User(user);
      console.log('✅ Instância User criada:', typeof userInstance.toJSON);
      return userInstance;
    } catch (error) {
      console.error('❌ Erro ao verificar senha:', error);
      throw error;
    }
  }

  // Atualizar último login
  async updateLastLogin() {
    try {
      const now = new Date().toISOString();
      await query(
        'UPDATE users_pabx SET last_login_at = $1 WHERE id = $2',
        [now, this.id]
      );
      
      this.lastLoginAt = now;
      return true;
    } catch (error) {
      console.error('❌ Erro ao atualizar último login:', error);
      throw error;
    }
  }

  // Buscar usuários por revendedor (para revendedores)
  static async findByReseller(resellerId) {
    try {
      const result = await query(
        'SELECT * FROM users_pabx WHERE parent_reseller_id = $1 ORDER BY created_at DESC',
        [resellerId]
      );
      
      return result.rows.map(userData => new User(userData));
    } catch (error) {
      console.error('❌ Erro ao buscar usuários por revendedor:', error);
      throw error;
    }
  }

  // Buscar todos os usuários (para admin)
  static async findAll(filters = {}) {
    try {
      // Base select
      let qb = supabase
        .from('users_pabx')
        .select('*')
        .order('created_at', { ascending: false });

      // Filtros
      if (filters.role) {
        qb = qb.eq('role', filters.role);
      }
      if (filters.status) {
        qb = qb.eq('status', filters.status);
      }
      if (filters.search) {
        const term = `%${filters.search}%`;
        // Supabase não suporta ILIKE OR encadeado numa só chamada, usar .or
        qb = qb.or(
          [
            `name.ilike.${term}`,
            `email.ilike.${term}`,
            `company.ilike.${term}`
          ].join(',')
        );
      }

      // Paginação (range é inclusivo)
      if (typeof filters.limit === 'number' && typeof filters.offset === 'number') {
        const from = filters.offset;
        const to = filters.offset + filters.limit - 1;
        qb = qb.range(from, to);
      }

      const { data, error } = await qb;
      if (error) {
        console.error('❌ Erro Supabase em findAll:', error);
        throw error;
      }
      return (data || []).map(userData => new User(userData));
    } catch (error) {
      console.error('❌ Erro ao buscar todos os usuários:', error);
      throw error;
    }
  }

  // Contar usuários (para paginação)
  static async count(filters = {}) {
    try {
      let qb = supabase
        .from('users_pabx')
        .select('*', { count: 'exact', head: true });

      if (filters.role) {
        qb = qb.eq('role', filters.role);
      }
      if (filters.status) {
        qb = qb.eq('status', filters.status);
      }
      if (filters.search) {
        const term = `%${filters.search}%`;
        qb = qb.or(
          [
            `name.ilike.${term}`,
            `email.ilike.${term}`,
            `company.ilike.${term}`
          ].join(',')
        );
      }

      const { count, error } = await qb;
      if (error) {
        console.error('❌ Erro Supabase em count:', error);
        throw error;
      }
      return typeof count === 'number' ? count : 0;
    } catch (error) {
      console.error('❌ Erro ao contar usuários:', error);
      throw error;
    }
  }

  // Atualizar último login do usuário
  static async updateLastLogin(userId) {
    try {
      console.log(`🕒 Atualizando último login para usuário: ${userId}`);
      
      const { data, error } = await supabase
        .from('users_pabx')
        .update({ 
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erro ao atualizar último login no Supabase:', error);
        throw error;
      }
      
      console.log(`✅ Último login atualizado com sucesso para usuário: ${userId}`);
      return data ? new User(data) : null;
    } catch (error) {
      console.error('❌ Erro ao atualizar último login:', error);
      throw error;
    }
  }

  // Atualizar último IP do usuário
  static async updateLastIp(userId, ip) {
    try {
      console.log(`🌐 Atualizando último IP para usuário: ${userId} -> ${ip}`);
      const { data, error } = await supabase
        .from('users_pabx')
        .update({
          last_ip: ip || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar último IP no Supabase:', error);
        throw error;
      }

      console.log(`✅ Último IP atualizado com sucesso para usuário: ${userId}`);
      return data ? new User(data) : null;
    } catch (error) {
      console.error('❌ Erro ao atualizar último IP:', error);
      throw error;
    }
  }

  // Atualizar senha do usuário
  static async updatePassword(userId, hashedPassword) {
    try {
      console.log(`🔐 Atualizando senha para usuário: ${userId}`);
      
      const { data, error } = await supabase
        .from('users_pabx')
        .update({ 
          password_hash: hashedPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erro ao atualizar senha no Supabase:', error);
        throw error;
      }
      
      console.log(`✅ Senha atualizada com sucesso para usuário: ${userId}`);
      return data ? new User(data) : null;
    } catch (error) {
      console.error('❌ Erro ao atualizar senha:', error);
      throw error;
    }
  }

  // Converter para JSON (removendo dados sensíveis)
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      name: this.name,
      company: this.company,
      phone: this.phone,
      role: this.role,
      status: this.status,
      credits: this.credits,
      planId: this.planId,
      parentResellerId: this.parentResellerId,
      maxConcurrentCalls: this.maxConcurrentCalls,
      createdBy: this.createdBy,
      timezone: this.timezone,
      language: this.language,
      settings: this.settings,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLoginAt: this.lastLoginAt,
      lastIp: this.lastIp,
      // Campos de plano
      planActivatedAt: this.planActivatedAt,
      planExpiresAt: this.planExpiresAt,
      planStatus: this.planStatus,
      // Flags e métricas adicionais
      webrtc: this.webrtc,
      autoDiscagem: this.autoDiscagem,
      upAudio: this.upAudio,
      smsEnvio: this.smsEnvio,
      maillingUp: this.maillingUp,
      planFree: this.planFree,
      totalCall: this.totalCall
    };
  }
}

module.exports = User;
