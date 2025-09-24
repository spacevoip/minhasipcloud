import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
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

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const auth = verifyToken(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Token de acesso inválido' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const userId = auth.userId; // Usar userId do token JWT

    if (!file || !name) {
      return NextResponse.json(
        { error: 'Arquivo e nome são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato não suportado. Use WAV, MP3 ou OGG.' },
        { status: 400 }
      );
    }

    // Validar tamanho (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo 10MB.' },
        { status: 400 }
      );
    }

    // Gerar nome único do arquivo
    const fileExtension = path.extname(file.name);
    const cleanName = name.toLowerCase().replace(/\s+/g, '-');
    const timestamp = Date.now();
    const uniqueFileName = `${cleanName}_${timestamp}${fileExtension}`;

    // Criar diretório se não existir
    const audioDir = path.join(process.cwd(), 'backend', 'audios');
    if (!existsSync(audioDir)) {
      await mkdir(audioDir, { recursive: true });
    }

    // Caminho completo do arquivo
    const filePath = path.join(audioDir, uniqueFileName);

    // Converter arquivo para buffer e salvar
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Salvar no banco de dados
    const { data: audioRecord, error: dbError } = await supabase
      .from('audios_pabx')
      .insert({
        name: name,
        file_path: uniqueFileName,
        user_id: userId,
        agent_id: null
      })
      .select()
      .single();

    if (dbError) {
      console.error('Erro ao salvar no banco:', dbError);
      return NextResponse.json(
        { error: 'Erro ao salvar áudio no banco de dados' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      audio: audioRecord,
      message: 'Áudio enviado com sucesso'
    });

  } catch (error) {
    console.error('Erro no upload:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
