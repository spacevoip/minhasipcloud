// =====================================================
// MAILINGS SERVICE - Serviço de Campanhas de Email
// =====================================================

const __DEV__ = process.env.NODE_ENV !== 'production';
const dlog = (...args: any[]) => { if (__DEV__) console.log(...args); };

export interface Agent {
  id: string;
  name: string;
  extension: string;
  status: boolean;
}

export interface Mailing {
  id: string;
  name: string;
  total: number;
  content?: any;
  status: 'active' | 'disabled' | 'working';
  created_at: string;
  updated_at: string;
  agent_id: string;
  agentes_pabx?: Agent;
}

export interface CreateMailingData {
  name: string;
  agent_id: string | null;
  total?: number;
  content?: any;
  status?: 'active' | 'disabled' | 'working';
}

export interface MailingsResponse {
  success: boolean;
  data: Mailing[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface SingleMailingResponse {
  success: boolean;
  data: Mailing;
  error?: string;
}

export interface AgentsResponse {
  success: boolean;
  data: Agent[];
  error?: string;
}

class MailingsService {
  private baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://api.yourdomain.com' 
    : 'http://localhost:3001';

  private getAuthHeaders() {
    const token = localStorage.getItem('token') || localStorage.getItem('agent_token');
    if (!token) {
      throw new Error('Token ausente. Faça login novamente.');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Buscar agentes do usuário para vincular à campanha
   * Usa a mesma API que a página /agents
   */
  async getUserAgents(): Promise<Agent[]> {
    try {
      dlog('📧 [MAILINGS SERVICE] Buscando agentes do usuário...');

      const response = await fetch(`${this.baseUrl}/api/agents`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store'
      });

      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        throw new Error(`Erro HTTP ${response.status} ${response.statusText} ${txt}`);
      }

      const payload = await response.json();
      const items = payload?.data || payload || [];
      
      // Converter para formato simplificado para mailings
      const agents: Agent[] = items.map((a: any) => ({
        id: a.id,
        name: a.name ?? a.agente_name,
        extension: a.ramal,
        status: Boolean(!a.blocked && !a.bloqueio)
      }));

      dlog(`✅ [MAILINGS SERVICE] ${agents.length} agentes encontrados`);
      return agents;

    } catch (error) {
      console.error('❌ [MAILINGS SERVICE] Erro ao buscar agentes:', error);
      throw error;
    }
  }

  /**
   * Listar campanhas do usuário
   */
  async getMailings(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<MailingsResponse> {
    try {
      dlog('📧 [MAILINGS SERVICE] Buscando campanhas...');

      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.append('page', params.page.toString());
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.status) searchParams.append('status', params.status);
      if (params?.search) searchParams.append('search', params.search);

      const url = `${this.baseUrl}/api/mailings${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result: MailingsResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao buscar campanhas');
      }

      dlog(`✅ [MAILINGS SERVICE] ${result.data.length} campanhas encontradas`);
      return result;

    } catch (error) {
      console.error('❌ [MAILINGS SERVICE] Erro ao buscar campanhas:', error);
      throw error;
    }
  }

  /**
   * Buscar campanha por ID
   */
  async getMailingById(id: string): Promise<Mailing> {
    try {
      dlog(`📧 [MAILINGS SERVICE] Buscando campanha: ${id}`);

      const response = await fetch(`${this.baseUrl}/api/mailings/${id}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result: SingleMailingResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao buscar campanha');
      }

      dlog(`✅ [MAILINGS SERVICE] Campanha encontrada: ${result.data.name}`);
      return result.data;

    } catch (error) {
      console.error('❌ [MAILINGS SERVICE] Erro ao buscar campanha:', error);
      throw error;
    }
  }

  /**
   * Criar nova campanha
   */
  async createMailing(data: CreateMailingData): Promise<Mailing> {
    try {
      dlog('📧 [MAILINGS SERVICE] Criando nova campanha...');

      const response = await fetch(`${this.baseUrl}/api/mailings`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data)
      });

      const result: SingleMailingResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao criar campanha');
      }

      dlog(`✅ [MAILINGS SERVICE] Campanha criada: ${result.data.name}`);
      return result.data;

    } catch (error) {
      console.error('❌ [MAILINGS SERVICE] Erro ao criar campanha:', error);
      throw error;
    }
  }

  /**
   * Excluir campanha
   */
  async deleteMailing(id: string): Promise<void> {
    try {
      dlog(`📧 [MAILINGS SERVICE] Excluindo campanha: ${id}`);

      const response = await fetch(`${this.baseUrl}/api/mailings/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao excluir campanha');
      }

      dlog(`✅ [MAILINGS SERVICE] Campanha excluída com sucesso`);

    } catch (error) {
      console.error('❌ [MAILINGS SERVICE] Erro ao excluir campanha:', error);
      throw error;
    }
  }

  /**
   * Analisar arquivo CSV e retornar preview com colunas
   */
  async analyzeCSVFile(file: File): Promise<{
    headers: string[];
    preview: string[][];
    totalRows: number;
  }> {
    try {
      dlog('📧 [MAILINGS SERVICE] Analisando arquivo CSV...');

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
              throw new Error('Arquivo vazio');
            }

            // Primeira linha são os cabeçalhos
            const headers = lines[0].split(',').map(h => h.trim());
            
            // Pegar as próximas 5 linhas para preview
            const preview: string[][] = [];
            for (let i = 1; i < Math.min(6, lines.length); i++) {
              const values = lines[i].split(',').map(v => v.trim());
              preview.push(values);
            }

            const result = {
              headers,
              preview,
              totalRows: lines.length - 1 // Excluir header
            };

            dlog(`✅ [MAILINGS SERVICE] Arquivo analisado: ${headers.length} colunas, ${result.totalRows} linhas`);
            resolve(result);

          } catch (error) {
            reject(error);
          }
        };

        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsText(file);
      });

    } catch (error) {
      console.error('❌ [MAILINGS SERVICE] Erro ao analisar arquivo:', error);
      throw error;
    }
  }

  /**
   * Processar arquivo CSV com mapeamento de colunas
   */
  async processContactsWithMapping(
    file: File, 
    columnMapping: { name?: number; email?: number; phone?: number }
  ): Promise<any[]> {
    try {
      dlog('📧 [MAILINGS SERVICE] Processando arquivo com mapeamento...');

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
              throw new Error('Arquivo vazio');
            }

            const contacts = [];
            
            // Pular header (linha 0) e processar dados
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',').map(v => v.trim());
              
              if (values.length === 0) continue;
              
              const contact: any = {
                name: columnMapping.name !== undefined ? values[columnMapping.name] || '' : '',
                email: columnMapping.email !== undefined ? values[columnMapping.email] || '' : '',
                phone: columnMapping.phone !== undefined ? values[columnMapping.phone] || '' : '',
                originalData: values // Manter dados originais
              };
              
              // Só adicionar se tiver pelo menos email ou nome
              if (contact.email || contact.name) {
                contacts.push(contact);
              }
            }

            dlog(`✅ [MAILINGS SERVICE] ${contacts.length} contatos processados com mapeamento`);
            resolve(contacts);

          } catch (error) {
            reject(error);
          }
        };

        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsText(file);
      });

    } catch (error) {
      console.error('❌ [MAILINGS SERVICE] Erro ao processar arquivo:', error);
      throw error;
    }
  }
}

export const mailingsService = new MailingsService();
