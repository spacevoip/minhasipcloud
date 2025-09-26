/**
 * =====================================================
 * CONTACT IMPORT SERVICE - IMPORTAÇÃO OTIMIZADA
 * =====================================================
 * Serviço para importar contatos de campanhas de forma otimizada
 * Performance: processamento em lote + inserção direta no PostgreSQL
 */

const { query: dbQuery } = require('../config/database');

class ContactImportService {
  constructor() {
    // Removido Redis para evitar erro de conexão
    this.cache = new Map(); // Cache em memória simples
  }

  /**
   * Criar campanha e importar contatos - APENAS PostgreSQL COPY
   */
  async createCampaignWithContacts(campaignData, contacts) {
    console.log(`📥 [IMPORT] Criando campanha: ${campaignData.name}`);
    
    const { Pool } = require('pg');
    const copyFrom = require('pg-copy-streams').from;
    
    // Debug resumido dos dados recebidos
    console.log(`🔧 [DEBUG] Campanha: ${campaignData.name} | Contatos: ${contacts ? contacts.length : 0}`);
    
    // Validação obrigatória
    if (!campaignData.userId) {
      throw new Error('user_id é obrigatório para criar campanha');
    }
    if (!campaignData.name) {
      throw new Error('name é obrigatório para criar campanha');
    }
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      throw new Error('contacts deve ser um array não vazio');
    }
    
    // Validar dados de distribuição
    const isMultipleAgents = !campaignData.agentId && campaignData.selectedAgents && campaignData.selectedAgents.length > 0;
    if (isMultipleAgents) {
      console.log(`⚠️ [DEBUG] Campanha com múltiplos agentes: ${campaignData.selectedAgents.length} ramais`);
    } else if (campaignData.agentId) {
      console.log(`⚠️ [DEBUG] Campanha com agente único: ${campaignData.agentId}`);
    } else {
      console.log(`⚠️ [DEBUG] Dados de distribuição:`, {
        agentId: campaignData.agentId,
        selectedAgents: campaignData.selectedAgents,
        hasSelectedAgents: !!(campaignData.selectedAgents && campaignData.selectedAgents.length > 0)
      });
      throw new Error('É necessário especificar agentId ou selectedAgents para distribuição');
    }
    
    // Pool dedicado para todas as operações usando credenciais do .env.local
    const pool = new Pool({
      host: process.env.POST_HOST,
      port: parseInt(process.env.POST_PORT),
      database: process.env.POST_DATABASE,
      user: process.env.POST_USER,
      password: process.env.POST_PASSWORD,
      max: 2, // 2 conexões: uma para campanha, outra para COPY
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: false // Desabilitar SSL para conexão direta
    });

    let client;
    
    try {
      client = await pool.connect();
      
      // 1. Criar campanha usando PostgreSQL direto
      const vinculoAll = isMultipleAgents ? campaignData.selectedAgents.map(agent => agent.id).join(',') : null;
      
      const campaignQuery = `
        INSERT INTO mailings_pabx (name, total, user_id, agent_id, vinculo_all, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, name, total, user_id, agent_id, vinculo_all, created_at
      `;
      
      console.log(`🔧 [DEBUG] Executando query: ${campaignData.name} (${contacts.length} contatos)`);
      console.log(`🔧 [DEBUG] vinculo_all: ${vinculoAll}`);
      
      const campaignResult = await client.query(campaignQuery, [
        campaignData.name,
        contacts.length,
        campaignData.userId,
        campaignData.agentId,
        vinculoAll
      ]);
      
      const campaign = campaignResult.rows[0];
      console.log(`✅ [IMPORT] Campanha criada: ID ${campaign.id}`);

      // 2. Distribuir contatos entre ramais e importar via COPY
      const contactsWithAgents = this.distributeContactsToAgents(
        contacts,
        isMultipleAgents ? campaignData.selectedAgents : [{ id: campaignData.agentId }],
        campaignData.distributionMode || 'automatic'
      );
      
      const imported = await this.insertContactsWithCopyDirect(
        client,
        campaign.id,
        campaignData.userId,
        contactsWithAgents
      );

      console.log(`🎯 [IMPORT] Importação concluída: ${imported}/${contacts.length} contatos`);

      return {
        success: true,
        campaignId: campaign.id,
        imported,
        total: contacts.length
      };

    } catch (error) {
      console.error('❌ [IMPORT] Erro na importação:', error);
      throw error;
    } finally {
      if (client) client.release();
      await pool.end();
    }
  }

  /**
   * Processar diferentes formatos de dados de contatos
   */
  parseContactsData(data) {
    const contacts = [];
    
    // Formato 1: Array direto de contatos
    if (Array.isArray(data?.contacts)) {
      return data.contacts.map((contact, index) => ({
        name: contact.name || contact.nome || '',
        phone: contact.phone || contact.number || contact.telefone || '',
        extraData: this.extractExtraData(contact),
        rowIndex: index
      }));
    }

    // Formato 2: Headers + Rows (CSV processado)
    if (Array.isArray(data?.headers) && Array.isArray(data?.rows)) {
      const headers = data.headers;
      const nameIndex = this.findHeaderIndex(headers, ['name', 'nome', 'cliente']);
      const phoneIndex = this.findHeaderIndex(headers, ['phone', 'telefone', 'number', 'numero']);

      return data.rows.map((row, index) => {
        const contact = {};
        headers.forEach((header, i) => {
          if (header) contact[header] = row[i];
        });

        return {
          name: row[nameIndex] || '',
          phone: row[phoneIndex] || '',
          extraData: contact,
          rowIndex: index
        };
      });
    }

    // Formato 3: Mapping personalizado
    if (data?.mapping && Array.isArray(data?.rows)) {
      const mapping = data.mapping;
      return data.rows.map((row, index) => ({
        name: row[mapping.name] || '',
        phone: row[mapping.phone] || row[mapping.number] || '',
        extraData: { originalRow: row },
        rowIndex: index
      }));
    }

    throw new Error('Formato de dados não suportado');
  }

  /**
   * Encontrar índice de header por nomes possíveis
   */
  findHeaderIndex(headers, possibleNames) {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => 
        h && h.toLowerCase().includes(name.toLowerCase())
      );
      if (index >= 0) return index;
    }
    return -1;
  }

  /**
   * Extrair dados extras (exceto name/phone)
   */
  extractExtraData(contact) {
    const { name, nome, phone, number, telefone, ...extra } = contact;
    return Object.keys(extra).length > 0 ? extra : {};
  }

  /**
   * Distribuir contatos entre agentes/ramais
   */
  distributeContactsToAgents(contacts, agents, distributionMode) {
    console.log(`🎯 [DISTRIBUTION] Distribuindo ${contacts.length} contatos entre ${agents.length} ramais`);
    
    if (agents.length === 1) {
      // Agente único - todos os contatos para o mesmo ramal
      return contacts.map(contact => ({
        ...contact,
        agent_id: agents[0].id
      }));
    }
    
    // Múltiplos agentes - distribuição automática ou manual
    const contactsWithAgents = [];
    
    if (distributionMode === 'manual') {
      // Distribuição manual baseada nas quantidades especificadas
      let contactIndex = 0;
      
      for (const agent of agents) {
        const quantity = agent.quantity || 0;
        for (let i = 0; i < quantity && contactIndex < contacts.length; i++) {
          contactsWithAgents.push({
            ...contacts[contactIndex],
            agent_id: agent.id
          });
          contactIndex++;
        }
      }
      
      // Se sobraram contatos, distribuir igualmente
      while (contactIndex < contacts.length) {
        for (const agent of agents) {
          if (contactIndex >= contacts.length) break;
          contactsWithAgents.push({
            ...contacts[contactIndex],
            agent_id: agent.id
          });
          contactIndex++;
        }
      }
    } else {
      // Distribuição automática - dividir igualmente
      contacts.forEach((contact, index) => {
        const agentIndex = index % agents.length;
        contactsWithAgents.push({
          ...contact,
          agent_id: agents[agentIndex].id
        });
      });
    }
    
    console.log(`✅ [DISTRIBUTION] Distribuição concluída: ${contactsWithAgents.length} contatos distribuídos`);
    return contactsWithAgents;
  }

  /**
   * Inserir contatos usando conexão existente - COPY DIRETO
   */
  async insertContactsWithCopyDirect(client, mailingId, userId, contactsWithAgents) {
    const copyFrom = require('pg-copy-streams').from;
    
    console.log(`🚀 [COPY] Iniciando COPY de ${contactsWithAgents.length} contatos...`);
    
    // Preparar dados no formato TSV (Tab Separated Values)
    const copyData = contactsWithAgents.map((contact, index) => {
      const name = (contact.name || '').replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');
      const phone = (contact.phone || '').replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');
      const agentIdValue = contact.agent_id || ''; // Usar o agent_id já distribuído
      
      // Debug: Log do contato para verificar dados_extras
      if (index < 3) { // Log apenas os primeiros 3 contatos
        console.log(`🔍 [DEBUG] Contato ${index + 1}:`, {
          name: contact.name,
          phone: contact.phone,
          dados_extras: contact.dados_extras,
          hasExtras: contact.dados_extras && Object.keys(contact.dados_extras).length > 0
        });
      }
      
      // Processar dados_extras como JSON
      let dadosExtrasJson = '';
      if (contact.dados_extras && Object.keys(contact.dados_extras).length > 0) {
        dadosExtrasJson = JSON.stringify(contact.dados_extras).replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');
        if (index < 3) {
          console.log(`🔍 [DEBUG] JSON gerado:`, dadosExtrasJson);
        }
      } else {
        if (index < 3) {
          console.log(`🔍 [DEBUG] Sem dados extras para contato ${index + 1}`);
        }
      }
      
      return `${name}\t${phone}\t${mailingId}\t${userId}\t${agentIdValue}\t${dadosExtrasJson}\t${new Date().toISOString()}`;
    }).join('\n');

    // Query COPY otimizada com dados_extras
    const copyQuery = `
      COPY mailings_contacts (name, phone, mailing_id, user_id, agent_id, dados_extras, created_at) 
      FROM STDIN WITH (FORMAT text, DELIMITER E'\t', NULL '')
    `;
    
    // Executar COPY FROM STDIN
    const stream = client.query(copyFrom(copyQuery));
    
    return new Promise((resolve, reject) => {
      stream.on('error', (error) => {
        console.error('❌ [COPY] Erro no stream:', error);
        reject(error);
      });
      
      stream.on('finish', () => {
        console.log(`✅ [COPY] ${contactsWithAgents.length} contatos inseridos com sucesso!`);
        resolve(contactsWithAgents.length);
      });
      
      // Enviar dados para o stream
      stream.write(copyData);
      stream.end();
    });
  }




  /**
   * Buscar contatos paginados (SUPER RÁPIDO) - Nova estrutura usando Supabase
   */
  async getContacts(mailingId, userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    // Cache key
    const cacheKey = `contacts:${mailingId}:${userId}:${page}:${limit}`;
    
    try {
      // Tentar cache em memória primeiro
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutos
        console.log(`📋 [CONTACTS] Cache hit: ${cacheKey}`);
        return cached.data;
      }

      const { supabase } = require('../config/database');

      // Buscar contatos com paginação
      const { data: contacts, error: contactsError } = await supabase
        .from('mailings_contacts')
        .select('id, name, phone, is_dialed, dialed_at, created_at')
        .eq('mailing_id', mailingId)
        .eq('user_id', userId)
        .order('id')
        .range(offset, offset + limit - 1);

      if (contactsError) {
        throw new Error(`Erro ao buscar contatos: ${contactsError.message}`);
      }

      // Buscar totais
      const { data: totals, error: totalsError } = await supabase
        .from('mailings_contacts')
        .select('id, is_dialed')
        .eq('mailing_id', mailingId)
        .eq('user_id', userId);

      if (totalsError) {
        throw new Error(`Erro ao buscar totais: ${totalsError.message}`);
      }

      const result = {
        contacts: contacts || [],
        total: totals?.length || 0,
        dialed: totals?.filter(c => c.is_dialed).length || 0,
        fromCache: false
      };

      // Cache em memória por 5 minutos
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      console.log(`🗄️ [CONTACTS] Supabase query: ${result.contacts.length}/${result.total}`);
      return result;

    } catch (error) {
      console.error('❌ [CONTACTS] Erro ao buscar contatos:', error);
      throw error;
    }
  }

  /**
   * Buscar contato específico por número - Nova estrutura usando Supabase
   */
  async resolveContact(mailingId, userId, phoneNumber) {
    try {
      const { supabase } = require('../config/database');
      
      // Normalizar número para busca
      const normalizedPhone = this.normalizePhone(phoneNumber);
      
      const { data: contact, error } = await supabase
        .from('mailings_contacts')
        .select('id, name, phone, is_dialed, dialed_at, created_at')
        .eq('mailing_id', mailingId)
        .eq('user_id', userId)
        .eq('phone', normalizedPhone)
        .single();
      
      if (error || !contact) {
        return { success: false, error: 'Contato não encontrado' };
      }

      return { success: true, data: contact };

    } catch (error) {
      console.error('❌ [CONTACTS] Erro ao resolver contato:', error);
      throw error;
    }
  }

  /**
   * Marcar contato como discado - Nova estrutura usando Supabase
   */
  async markAsDialed(mailingId, userId, contactId) {
    try {
      const { supabase } = require('../config/database');
      
      // Marcar contato como discado
      const { error: updateError } = await supabase
        .from('mailings_contacts')
        .update({
          is_dialed: true,
          dialed_at: new Date().toISOString()
        })
        .eq('mailing_id', mailingId)
        .eq('user_id', userId)
        .eq('id', contactId);
      
      if (updateError) {
        throw new Error(`Erro ao marcar contato: ${updateError.message}`);
      }

      // Atualizar contador na campanha (total_discados += 1) via SQL direto para garantir incremento atômico
      try {
        await dbQuery(
          'UPDATE mailings_pabx SET total_discados = COALESCE(total_discados, 0) + 1, updated_at = NOW() WHERE id = $1 AND user_id = $2',
          [mailingId, userId]
        );
      } catch (e) {
        console.warn('⚠️ [CONTACTS] Erro ao incrementar total_discados:', e.message || e);
      }

      // Invalidar cache
      await this.invalidateCache(mailingId, userId);

      return { success: true };

    } catch (error) {
      console.error('❌ [CONTACTS] Erro ao marcar como discado:', error);
      throw error;
    }
  }

  /**
   * Normalizar telefone
   */
  normalizePhone(phone) {
    if (!phone) return '';
    
    // Remove tudo exceto dígitos
    let digits = String(phone).replace(/\D/g, '');
    
    // Remove prefixo 55 se tiver mais de 11 dígitos
    if (digits.startsWith('55') && digits.length > 11) {
      digits = digits.slice(2);
    }
    
    // Remove zeros à esquerda se tiver mais de 11 dígitos
    if (digits.startsWith('0') && digits.length > 11) {
      digits = digits.replace(/^0+/, '');
    }
    
    return digits;
  }

  /**
   * Invalidar cache de contatos
   */
  async invalidateCache(campaignId, userId) {
    try {
      const pattern = `contacts:${campaignId}:${userId}:`;
      let invalidated = 0;
      
      for (const [key] of this.cache) {
        if (key.startsWith(pattern)) {
          this.cache.delete(key);
          invalidated++;
        }
      }
      
      console.log(`🗑️ [CACHE] Invalidated ${invalidated} cache entries`);
    } catch (error) {
      console.error('❌ [CACHE] Erro ao invalidar cache:', error);
    }
  }
}

module.exports = new ContactImportService();
