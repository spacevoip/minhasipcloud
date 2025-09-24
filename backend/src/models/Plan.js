const { query, supabase } = require('../config/database');
const axios = require('axios');

class Plan {
  constructor(planData) {
    this.id = planData.id;
    this.name = planData.name;
    this.slug = planData.slug;
    this.price = planData.price;
    this.maxAgents = planData.max_agents;
    this.periodDays = planData.period_days;
    this.features = planData.features;
    this.description = planData.description;
    this.status = planData.status;
    this.createdBy = planData.created_by ?? null;
    this.resellerId = planData.reseller_id ?? null;
    this.createdAt = planData.created_at;
    this.updatedAt = planData.updated_at;
    this.calls_unlimited = planData.calls_unlimited;
    this.max_concurrent_calls = planData.max_concurrent_calls;
  }

  // Buscar todos os planos
  static async findAll(filters = {}) {
    try {
      console.log('🔄 Buscando todos os planos...');
      
      // Usar cliente Supabase
      let query = supabase
        .from('planos_pabx')
        .select('*');

      // Filtro por status
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      // Ordenação
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️  Tabela planos_pabx não existe ainda');
          return [];
        }
        throw error;
      }
      
      console.log(`✅ ${data.length} planos encontrados`);
      return data.map(planData => new Plan(planData));
    } catch (error) {
      console.error('❌ Erro ao buscar todos os planos:', error);
      throw error;
    }
  }

  // Buscar planos com filtros, busca e paginação (retorna itens e total)
  static async searchAndPaginate({
    status,
    search,
    created_by,
    reseller_id,
    limit = 20,
    offset = 0,
    orderBy = 'created_at',
    order = 'desc'
  } = {}) {
    try {
      console.log('🔄 Buscando planos com paginação/filters...');

      let q = supabase
        .from('planos_pabx')
        .select('*', { count: 'exact' });

      if (status) q = q.eq('status', status);
      if (created_by) q = q.eq('created_by', created_by);
      if (reseller_id) q = q.eq('reseller_id', reseller_id);
      if (search) {
        // Busca por nome ou slug (case-insensitive)
        q = q.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
      }

      // Ordenação
      q = q.order(orderBy, { ascending: String(order).toLowerCase() === 'asc' });

      // Paginação
      const from = Number(offset);
      const to = from + Number(limit) - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️  Tabela planos_pabx não existe ainda');
          return { items: [], total: 0 };
        }
        throw error;
      }

      return {
        items: (data || []).map(p => new Plan(p)),
        total: count || 0
      };
    } catch (error) {
      console.error('❌ Erro ao buscar planos com paginação:', error);
      throw error;
    }
  }

  // Buscar planos ativos
  static async findActive() {
    try {
      console.log('🔄 Buscando planos ativos...');
      return await this.findAll({ status: 'active' });
    } catch (error) {
      console.error('❌ Erro ao buscar planos ativos:', error);
      throw error;
    }
  }

  // Buscar plano por ID
  static async findById(id) {
    try {
      console.log('🔄 Buscando plano por ID:', id);
      
      // Usar cliente Supabase
      const { data, error } = await supabase
        .from('planos_pabx')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️  Tabela planos_pabx não existe ainda');
          return null;
        }
        if (error.code === 'PGRST100') {
          // Nenhum resultado encontrado
          console.log('⚠️  Plano não encontrado:', id);
          return null;
        }
        throw error;
      }
      
      console.log('✅ Plano encontrado:', data.name);
      return data ? new Plan(data) : null;
    } catch (error) {
      console.error('❌ Erro ao buscar plano por ID:', error);
      throw error;
    }
  }

  // Criar novo plano - usando cliente Supabase (sem REST direto)
  static async create(planData) {
    try {
      console.log('🔄 Criando plano (Supabase client):', planData.name);

      if (!planData.name) {
        throw new Error('Nome do plano é obrigatório');
      }

      const slug = planData.slug || String(planData.name).toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

      const insertData = {
        name: String(planData.name).trim(),
        slug: String(slug).trim(),
        price: parseFloat(planData.price) || 0,
        currency: planData.currency || 'BRL',
        max_agents: parseInt(planData.max_agents ?? planData.maxAgents) || 1,
        period_days: parseInt(planData.period_days ?? planData.periodDays) || 30,
        calls_unlimited: planData.calls_unlimited ?? true,
        description: String(planData.description || 'Plano personalizado').trim(),
        short_description: planData.short_description || `Limite de ${parseInt(planData.max_agents ?? planData.maxAgents) || 1} ramais • Validade de ${parseInt(planData.period_days ?? planData.periodDays) || 30} dias`,
        is_popular: !!planData.is_popular,
        is_featured: !!planData.is_featured,
        color: planData.color || '#64748b',
        icon: planData.icon || 'package',
        display_order: parseInt(planData.display_order) || 0,
        status: planData.status || 'active',
        visibility: planData.visibility || 'public',
        subscribers_count: 0,
        trial_days: parseInt(planData.trial_days) || 0,
        setup_fee: parseFloat(planData.setup_fee) || 0,
        max_storage_gb: parseInt(planData.max_storage_gb ?? planData.max_agents ?? planData.maxAgents) || 1,
        max_concurrent_calls: planData.max_concurrent_calls ?? null,
        recording_enabled: planData.recording_enabled ?? true,
        api_access: planData.api_access ?? false,
        priority_support: planData.priority_support ?? false,
        created_by: planData.created_by ?? null,
        reseller_id: planData.reseller_id ?? null,
        features: Array.isArray(planData.features) ? planData.features : ['Recursos básicos'],
        metadata: planData.metadata || {}
      };

      const { data, error } = await supabase
        .from('planos_pabx')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Plano criado com sucesso:', data.name);
      return new Plan(data);
    } catch (error) {
      console.error('❌ Erro ao criar plano:', error);
      throw error;
    }
  }

  // Atualizar plano
  async update(updateData) {
    try {
      console.log('🔄 Atualizando plano:', this.id);
      
      const { data, error } = await supabase
        .from('planos_pabx')
        .update({
          name: updateData.name || this.name,
          price: updateData.price || this.price,
          max_agents: updateData.maxAgents || this.maxAgents,
          period_days: updateData.periodDays || this.periodDays,
          features: updateData.features || this.features,
          description: updateData.description || this.description,
          status: updateData.status || this.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Atualizar propriedades do objeto
      Object.assign(this, new Plan(data));
      
      console.log('✅ Plano atualizado com sucesso');
      return this;
    } catch (error) {
      console.error('❌ Erro ao atualizar plano:', error);
      throw error;
    }
  }

  // Excluir plano
  async delete() {
    try {
      console.log('🔄 Excluindo plano:', this.id);
      
      const { error } = await supabase
        .from('planos_pabx')
        .delete()
        .eq('id', this.id);
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Plano excluído com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao excluir plano:', error);
      throw error;
    }
  }

  // Contar usuários por plano
  static async getUserCountByPlan(planId) {
    try {
      console.log('🔄 Contando usuários do plano (Supabase):', planId);
      // Usar cliente Supabase com head+count para evitar erros de tenant
      const { count, error } = await supabase
        .from('users_pabx')
        .select('id', { count: 'exact', head: true })
        .eq('plan_id', planId);
      if (error) {
        console.error('❌ Erro Supabase ao contar usuários por plano:', error);
        return 0;
      }
      const safeCount = Number.isFinite(Number(count)) ? Number(count) : 0;
      console.log(`✅ ${safeCount} usuários encontrados para o plano`);
      return safeCount;
    } catch (error) {
      console.error('❌ Erro ao contar usuários por plano:', error);
      return 0; // Retorna 0 em caso de erro
    }
  }

  // Contar usuários para múltiplos planos usando agregação SQL otimizada
  static async getUsersCountForPlans(planIds = []) {
    try {
      if (!Array.isArray(planIds) || planIds.length === 0) return {};
      
      // Usar query SQL direta com GROUP BY para melhor performance
      const placeholders = planIds.map((_, index) => `$${index + 1}`).join(',');
      const sql = `
        SELECT plan_id, COUNT(*)::int as count 
        FROM users_pabx 
        WHERE plan_id IN (${placeholders})
        GROUP BY plan_id
      `;
      
      const result = await query(sql, planIds);
      
      // Inicializar todos os planos com count 0
      const counts = {};
      for (const id of planIds) counts[id] = 0;
      
      // Preencher com os counts reais
      for (const row of result?.rows || []) {
        if (row && row.plan_id) {
          counts[row.plan_id] = row.count || 0;
        }
      }
      
      return counts;
    } catch (error) {
      console.error('❌ Erro ao contar usuários para múltiplos planos:', error);
      // Fallback para método anterior em caso de erro
      try {
        const { data, error: supabaseError } = await supabase
          .from('users_pabx')
          .select('plan_id')
          .in('plan_id', planIds);
        if (supabaseError) return {};
        
        const counts = {};
        for (const id of planIds) counts[id] = 0;
        for (const row of data || []) {
          if (row && row.plan_id && counts.hasOwnProperty(row.plan_id)) {
            counts[row.plan_id] += 1;
          }
        }
        return counts;
      } catch {
        return {};
      }
    }
  }

  // Converter para JSON
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      price: this.price,
      maxAgents: this.maxAgents,
      periodDays: this.periodDays,
      features: this.features,
      description: this.description,
      status: this.status,
      createdBy: this.createdBy,
      resellerId: this.resellerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      calls_unlimited: this.calls_unlimited,
      max_concurrent_calls: this.max_concurrent_calls
    };
  }
}

module.exports = Plan;
