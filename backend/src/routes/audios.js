const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://31.97.84.157:8000',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

// Middleware para verificar token JWT (suporta header e query param)
const verifyToken = (req, res, next) => {
  // Tentar pegar token do header Authorization ou query parameter
  let token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    token = req.query.token;
  }
  
  if (!token) {
    console.error('❌ [AUDIOS] Token não fornecido');
    return res.status(401).json({ success: false, message: 'Token não fornecido' });
  }

  try {
    // Tentar decodificar como token de agente primeiro
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.agente_name) {
      // Token de agente
      console.log(`✅ [AUDIOS] Token válido para agente: ${decoded.id} (${decoded.agente_name})`);
      req.agent = decoded;
      req.userType = 'agent';
    } else if (decoded.role) {
      // Token de usuário normal (admin/user/reseller)
      console.log(`✅ [AUDIOS] Token válido para usuário: ${decoded.id} (${decoded.role})`);
      req.user = decoded;
      req.userType = 'user';
    } else {
      throw new Error('Tipo de token não reconhecido');
    }
    
    next();
  } catch (error) {
    console.error('❌ [AUDIOS] Token inválido:', error.message);
    console.error('❌ [AUDIOS] JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../audios');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `audio_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não suportado'), false);
    }
  }
});

// GET /api/audios/list - Buscar áudios do usuário (admin ou normal)
router.get('/list', verifyToken, async (req, res) => {
  try {
    if (req.userType !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Endpoint apenas para usuários normais/admin'
      });
    }

    const userId = req.user.id;
    console.log(`🎵 [AUDIOS] Buscando áudios para usuário: ${userId} (${req.user.role})`);

    let audioFiles;
    
    if (req.user.role === 'admin') {
      // Admin vê todos os áudios do sistema
      const { data, error } = await supabase
        .from('audios_pabx')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ [AUDIOS] Erro ao buscar áudios (admin):', error);
        return res.status(500).json({
          success: false,
          message: 'Erro interno do servidor'
        });
      }
      
      audioFiles = data || [];
    } else {
      // Usuário normal vê apenas seus próprios áudios
      const { data, error } = await supabase
        .from('audios_pabx')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ [AUDIOS] Erro ao buscar áudios (user):', error);
        return res.status(500).json({
          success: false,
          message: 'Erro interno do servidor'
        });
      }
      
      audioFiles = data || [];
    }

    console.log(`✅ [AUDIOS] ${audioFiles.length} áudios encontrados`);

    res.json({
      success: true,
      audios: audioFiles
    });

  } catch (error) {
    console.error('❌ [AUDIOS] Erro ao buscar áudios:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/audios/agent/:agentId - Buscar áudios do agente
router.get('/agent/:agentId', verifyToken, async (req, res) => {
  try {
    const { agentId } = req.params;

    console.log(`🎵 [AUDIOS] Buscando áudios para agente: ${agentId}`);

    // Buscar dados do agente para obter user_id
    const { data: agentData, error: agentError } = await supabase
      .from('agentes_pabx')
      .select('user_id')
      .eq('id', agentId)
      .single();

    if (agentError || !agentData) {
      console.error('❌ [AUDIOS] Agente não encontrado:', agentError);
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado'
      });
    }

    const userId = agentData.user_id;
    console.log(`🎵 [AUDIOS] User ID do agente: ${userId}`);

    // Buscar áudios seguindo a lógica especificada:
    // 1. Áudios com agent_id específico (exclusivos) - com estrela
    // 2. Áudios apenas com user_id (compartilhados) - sem estrela
    const { data: audioFiles, error } = await supabase
      .from('audios_pabx')
      .select('*')
      .or(`and(user_id.eq.${userId},agent_id.eq.${agentId}),and(user_id.eq.${userId},agent_id.is.null)`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [AUDIOS] Erro ao buscar áudios:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }

    console.log(`✅ [AUDIOS] ${audioFiles?.length || 0} áudios encontrados`);

    // Mapear os resultados para incluir flag isExclusive
    const mappedAudios = (audioFiles || []).map(audio => ({
      ...audio,
      isExclusive: !!audio.agent_id // true se tem agent_id, false se não tem
    }));

    res.json({
      success: true,
      data: mappedAudios
    });

  } catch (error) {
    console.error('❌ [AUDIOS] Erro ao buscar áudios:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/audios/upload - Upload de áudio
router.post('/upload', verifyToken, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado'
      });
    }

    const { name, agent_id, userId } = req.body;

    if (!name) {
      // Remover arquivo se dados inválidos
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Nome é obrigatório'
      });
    }

    let finalUserId = null;
    let finalAgentId = null;

    if (req.userType === 'agent') {
      // Upload por agente - precisa do agent_id
      if (!agent_id) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'ID do agente é obrigatório'
        });
      }

      // Buscar dados do agente para obter user_id
      const { data: agentData, error: agentError } = await supabase
        .from('agentes_pabx')
        .select('user_id')
        .eq('id', agent_id)
        .single();

      if (agentError || !agentData) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Agente não encontrado'
        });
      }

      finalUserId = agentData.user_id;
      finalAgentId = agent_id;
    } else if (req.userType === 'user') {
      // Upload por usuário normal/admin
      finalUserId = userId || req.user.id;
      finalAgentId = null; // Áudio compartilhado, não exclusivo de agente
    } else {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({
        success: false,
        message: 'Tipo de usuário não autorizado'
      });
    }

    // Salvar informações no banco
    const { data: audioRecord, error } = await supabase
      .from('audios_pabx')
      .insert([{
        name: name,
        user_id: finalUserId,
        agent_id: finalAgentId,
        file_path: req.file.filename
      }])
      .select()
      .single();

    if (error) {
      // Remover arquivo se erro no banco
      fs.unlinkSync(req.file.path);
      console.error('Erro ao salvar áudio no banco:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao salvar áudio'
      });
    }

    res.json({
      success: true,
      message: 'Áudio enviado com sucesso',
      data: {
        ...audioRecord,
        isExclusive: !!finalAgentId // true se tem agent_id, false se é compartilhado
      }
    });

  } catch (error) {
    // Remover arquivo em caso de erro
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Erro no upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/audios/play/:audioId - Reproduzir áudio
router.get('/play/:audioId', verifyToken, async (req, res) => {
  try {
    const { audioId } = req.params;

    console.log(`🎵 [AUDIOS] Tentando reproduzir áudio ID: ${audioId}`);

    // Buscar informações do áudio
    const { data: audioData, error } = await supabase
      .from('audios_pabx')
      .select('file_path, name')
      .eq('id', audioId)
      .single();

    if (error || !audioData) {
      console.error('❌ [AUDIOS] Áudio não encontrado no banco:', error);
      return res.status(404).json({
        success: false,
        message: 'Áudio não encontrado'
      });
    }

    console.log(`🎵 [AUDIOS] Áudio encontrado: ${audioData.name}, file_path: ${audioData.file_path}`);

    const filePath = path.join(__dirname, '../../audios', audioData.file_path);
    console.log(`🎵 [AUDIOS] Caminho completo do arquivo: ${filePath}`);

    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      console.error(`❌ [AUDIOS] Arquivo físico não encontrado: ${filePath}`);
      return res.status(404).json({
        success: false,
        message: 'Arquivo de áudio não encontrado no sistema de arquivos'
      });
    }

    console.log(`✅ [AUDIOS] Arquivo encontrado, iniciando streaming...`);

    // Detectar tipo de arquivo baseado na extensão
    const ext = path.extname(audioData.file_path).toLowerCase();
    let contentType = 'audio/mpeg'; // default
    
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
      case '.m4a':
        contentType = 'audio/mp4';
        break;
    }

    console.log(`🎵 [AUDIOS] Content-Type detectado: ${contentType}`);

    // Definir headers para streaming de áudio
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Headers CORS específicos para áudio
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (range) {
      // Suporte para range requests (para players de áudio)
      console.log(`🎵 [AUDIOS] Range request: ${range}`);
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      console.log(`🎵 [AUDIOS] Streaming arquivo completo (${fileSize} bytes)`);
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }

  } catch (error) {
    console.error('❌ [AUDIOS] Erro ao reproduzir áudio:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/audios/:audioId - Excluir áudio
router.delete('/:audioId', verifyToken, async (req, res) => {
  try {
    const { audioId } = req.params;

    // Buscar informações do áudio antes de excluir
    const { data: audioData, error: fetchError } = await supabase
      .from('audios_pabx')
      .select('file_path, user_id, agent_id')
      .eq('id', audioId)
      .single();

    if (fetchError || !audioData) {
      return res.status(404).json({
        success: false,
        message: 'Áudio não encontrado'
      });
    }

    let canDelete = false;

    if (req.userType === 'agent') {
      // Verificar permissão para agente
      const agentId = req.agent.id;
      const { data: agentInfo, error: agentError } = await supabase
        .from('agentes_pabx')
        .select('user_id')
        .eq('id', agentId)
        .single();

      if (agentError || !agentInfo) {
        return res.status(403).json({
          success: false,
          message: 'Permissão negada'
        });
      }

      // Agente pode excluir seus próprios áudios exclusivos ou áudios compartilhados do seu usuário
      canDelete = (
        // Áudio exclusivo do próprio agente
        (audioData.agent_id === agentId) ||
        // Áudio do usuário sem agente específico (compartilhado)
        (audioData.user_id === agentInfo.user_id && !audioData.agent_id)
      );
    } else if (req.userType === 'user') {
      // Verificar permissão para usuário normal/admin
      const userId = req.user.id;
      
      if (req.user.role === 'admin') {
        // Admin pode excluir qualquer áudio
        canDelete = true;
      } else {
        // Usuário normal pode excluir apenas seus próprios áudios
        canDelete = (audioData.user_id === userId);
      }
    }

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para excluir este áudio'
      });
    }

    // Excluir do banco
    const { error: deleteError } = await supabase
      .from('audios_pabx')
      .delete()
      .eq('id', audioId);

    if (deleteError) {
      console.error('Erro ao excluir áudio do banco:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Erro ao excluir áudio'
      });
    }

    // Excluir arquivo físico
    const filePath = path.join(__dirname, '../../audios', audioData.file_path);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (fileError) {
        console.error('Erro ao excluir arquivo físico:', fileError);
        // Não retornar erro aqui, pois o registro já foi excluído do banco
      }
    }

    res.json({
      success: true,
      message: 'Áudio excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir áudio:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
