import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
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

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    // Verificar autenticação
    const auth = verifyToken(request);
    if (!auth) {
      return new NextResponse('Token de acesso inválido', { status: 401 });
    }

    const filename = params.filename;

    // Verificar se o áudio pertence ao usuário ou é compartilhado
    const { data: audio, error: findError } = await supabase
      .from('audios_pabx')
      .select('id, file_path, user_id, agent_id')
      .eq('file_path', filename)
      .single();

    if (findError || !audio) {
      return new NextResponse('Áudio não encontrado', { status: 404 });
    }

    // Verificar permissão: deve ser do usuário ou compartilhado (agent_id = null)
    if (audio.user_id !== auth.userId && audio.agent_id !== null) {
      return new NextResponse('Sem permissão para acessar este áudio', { status: 403 });
    }

    const audioPath = path.join(process.cwd(), 'backend', 'audios', filename);

    // Verificar se o arquivo existe
    if (!existsSync(audioPath)) {
      return new NextResponse('Arquivo não encontrado', { status: 404 });
    }

    // Ler o arquivo
    const audioBuffer = await readFile(audioPath);
    
    // Determinar o tipo de conteúdo baseado na extensão
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'audio/mpeg';
    
    switch (ext) {
      case '.wav':
        contentType = 'audio/wav';
        break;
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
      case '.ogg':
        contentType = 'audio/ogg';
        break;
      default:
        contentType = 'audio/mpeg';
    }

    // Retornar o arquivo de áudio
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
        'Accept-Ranges': 'bytes'
      }
    });

  } catch (error) {
    console.error('Erro ao servir áudio:', error);
    return new NextResponse('Erro interno do servidor', { status: 500 });
  }
}
