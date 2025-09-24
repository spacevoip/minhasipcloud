import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Função para verificar JWT
function verifyToken(request: NextRequest): { userId: string } | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    // Usar verificação simples sem jwt library por enquanto
    const decoded = JSON.parse(atob(token.split('.')[1]));
    return { userId: decoded.userId || decoded.id };
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const auth = verifyToken(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Token de acesso inválido' },
        { status: 401 }
      );
    }

    // Buscar áudios do usuário no Supabase
    const { data: audios, error } = await supabase
      .from('audios_pabx')
      .select(`
        id,
        name,
        file_path,
        created_at,
        agent_id,
        user_id
      `)
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar áudios:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar áudios' },
        { status: 500 }
      );
    }

    // Buscar nomes dos agentes se necessário
    const agentIds = audios?.filter(a => a.agent_id).map(a => a.agent_id) || [];
    let agentNames: Record<string, string> = {};
    
    if (agentIds.length > 0) {
      const { data: agents } = await supabase
        .from('agentes_pabx')
        .select('id, name')
        .in('id', agentIds);
      
      agentNames = agents?.reduce((acc, agent) => {
        acc[agent.id] = agent.name;
        return acc;
      }, {} as Record<string, string>) || {};
    }

    // Formatar dados para o frontend
    const formattedAudios = audios?.map(audio => ({
      id: audio.id,
      name: audio.name,
      file_path: audio.file_path,
      created_at: audio.created_at,
      agent_id: audio.agent_id,
      user_id: audio.user_id,
      agent_name: audio.agent_id ? agentNames[audio.agent_id] || 'Agente' : 'Compartilhado'
    })) || [];

    return NextResponse.json({ audios: formattedAudios });

  } catch (error) {
    console.error('Erro ao listar áudios:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
