import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params antes de usar
    const { id } = await params;
    
    // Obter token do header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'Token de autorização necessário' },
        { status: 401 }
      );
    }

    const { targetExtension } = await request.json();
    
    if (!targetExtension) {
      return NextResponse.json(
        { success: false, message: 'Ramal de destino é obrigatório' },
        { status: 400 }
      );
    }

    // Fazer chamada para a API do backend
    const backendResponse = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/api/call-transfer/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        channelId: id,
        targetExtension: targetExtension,
        transferType: 'blind'
      })
    });

    const result = await backendResponse.json();
    
    if (!backendResponse.ok) {
      return NextResponse.json(
        { 
          success: false, 
          message: result.message || 'Erro na transferência' 
        },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Chamada transferida para ramal ${targetExtension}`,
      data: result.data
    });

  } catch (error) {
    console.error('❌ Erro na transferência:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Erro interno na transferência' 
      },
      { status: 500 }
    );
  }
}
