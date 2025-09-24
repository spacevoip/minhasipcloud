import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    // Verificar autenticação
    const auth = verifyToken(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Token de acesso inválido' },
        { status: 401 }
      );
    }

    const filename = params.filename;

    // Buscar áudio no banco para verificar se pertence ao usuário
    const { data: audio, error: findError } = await supabase
      .from('audios_pabx')
      .select('id, file_path, user_id')
      .eq('file_path', filename)
      .eq('user_id', auth.userId)
      .single();

    if (findError || !audio) {
      return NextResponse.json(
        { error: 'Áudio não encontrado ou sem permissão' },
        { status: 404 }
      );
    }

    // Deletar do banco de dados
    const { error: deleteError } = await supabase
      .from('audios_pabx')
      .delete()
      .eq('id', audio.id);

    if (deleteError) {
      console.error('Erro ao deletar do banco:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao deletar áudio do banco de dados' },
        { status: 500 }
      );
    }

    // Deletar arquivo físico
    const audioPath = path.join(process.cwd(), 'backend', 'audios', filename);
    if (existsSync(audioPath)) {
      await unlink(audioPath);
    }

    return NextResponse.json({
      success: true,
      message: 'Áudio deletado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar áudio:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
