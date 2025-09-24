'use client';

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useSentryPABX } from '@/hooks/useSentryPABX';

export default function SentryTestPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const { 
    setUserContext, 
    setPABXContext, 
    captureActiveCallError,
    captureExtensionStatusError,
    captureAuthError,
    captureAPIError,
    addPABXBreadcrumb,
    startTransaction
  } = useSentryPABX();

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Teste 1: Erro básico
  const testBasicError = () => {
    try {
      throw new Error('Teste de erro básico do Sentry PABX');
    } catch (error) {
      Sentry.captureException(error);
      addResult('✅ Erro básico enviado para Sentry');
    }
  };

  // Teste 2: Contexto de usuário PABX
  const testUserContext = () => {
    setUserContext({
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'admin@pabx.com',
      role: 'admin',
      accountcode: '1000'
    });
    addResult('✅ Contexto de usuário PABX configurado');
  };

  // Teste 3: Contexto específico do PABX
  const testPABXContext = () => {
    setPABXContext({
      activeCallsCount: 5,
      onlineAgentsCount: 12,
      userRole: 'admin',
      currentPage: 'sentry-test'
    });
    addResult('✅ Contexto PABX configurado');
  };

  // Teste 4: Erro de chamada ativa
  const testActiveCallError = () => {
    const mockCallData = {
      callId: 'test-call-123',
      extension: '1000',
      status: 'failed'
    };
    
    captureActiveCallError(
      new Error('Falha ao processar chamada ativa'),
      mockCallData
    );
    addResult('✅ Erro de chamada ativa enviado');
  };

  // Teste 5: Erro de status de ramal
  const testExtensionError = () => {
    captureExtensionStatusError(
      new Error('Falha ao verificar status do ramal'),
      '1000'
    );
    addResult('✅ Erro de status de ramal enviado');
  };

  // Teste 6: Erro de autenticação
  const testAuthError = () => {
    captureAuthError(
      new Error('Token JWT inválido'),
      'jwt'
    );
    addResult('✅ Erro de autenticação enviado');
  };

  // Teste 7: Erro de API
  const testAPIError = () => {
    captureAPIError(
      new Error('API retornou 500'),
      '/api/active-calls',
      'GET'
    );
    addResult('✅ Erro de API enviado');
  };

  // Teste 8: Breadcrumb
  const testBreadcrumb = () => {
    addPABXBreadcrumb(
      'Usuário iniciou teste do Sentry',
      'testing',
      { testType: 'manual', timestamp: new Date().toISOString() }
    );
    addResult('✅ Breadcrumb adicionado');
  };

  // Teste 9: Performance Transaction
  const testTransaction = () => {
    const transaction = startTransaction('sentry-test', 'test');
    
    // Simular operação
    setTimeout(() => {
      transaction.finish();
      addResult('✅ Transaction de performance enviada');
    }, 1000);
  };

  // Teste 10: Erro com contexto completo
  const testCompleteError = () => {
    // Configurar contexto completo
    setUserContext({
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'admin@pabx.com',
      role: 'admin',
      accountcode: '1000'
    });

    setPABXContext({
      activeCallsCount: 3,
      onlineAgentsCount: 8,
      userRole: 'admin',
      currentPage: 'sentry-test'
    });

    addPABXBreadcrumb(
      'Iniciando teste completo',
      'testing'
    );

    // Enviar erro com contexto
    Sentry.withScope((scope) => {
      scope.setTag('test.type', 'complete');
      scope.setLevel('error');
      scope.setContext('test_data', {
        testNumber: 10,
        timestamp: new Date().toISOString(),
        browser: navigator.userAgent
      });
      
      Sentry.captureException(new Error('Teste completo com contexto PABX'));
    });

    addResult('✅ Erro completo com contexto enviado');
  };

  const runAllTests = async () => {
    setTestResults([]);
    addResult('🚀 Iniciando todos os testes...');
    
    testUserContext();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testPABXContext();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testBreadcrumb();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testBasicError();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testActiveCallError();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testExtensionError();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testAuthError();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testAPIError();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testTransaction();
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    testCompleteError();
    
    addResult('🎉 Todos os testes concluídos! Verifique o painel do Sentry.');
  };

  return (
    <div style={{ 
      padding: '2rem', 
      maxWidth: '1200px', 
      margin: '0 auto',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '2rem',
        borderRadius: '12px',
        marginBottom: '2rem',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 'bold' }}>
          🔍 Teste do Sentry PABX
        </h1>
        <p style={{ margin: '1rem 0 0 0', fontSize: '1.2rem', opacity: 0.9 }}>
          Página para testar a integração do Sentry com o sistema PABX
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <button 
          onClick={testBasicError}
          style={{
            padding: '1rem',
            background: '#ff4757',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          🚨 Teste Erro Básico
        </button>

        <button 
          onClick={testUserContext}
          style={{
            padding: '1rem',
            background: '#3742fa',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          👤 Contexto Usuário
        </button>

        <button 
          onClick={testPABXContext}
          style={{
            padding: '1rem',
            background: '#2ed573',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          📞 Contexto PABX
        </button>

        <button 
          onClick={testActiveCallError}
          style={{
            padding: '1rem',
            background: '#ff6b6b',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          📱 Erro Chamada
        </button>

        <button 
          onClick={testExtensionError}
          style={{
            padding: '1rem',
            background: '#ffa502',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          🔌 Erro Ramal
        </button>

        <button 
          onClick={testAuthError}
          style={{
            padding: '1rem',
            background: '#ff3838',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          🔐 Erro Auth
        </button>

        <button 
          onClick={testAPIError}
          style={{
            padding: '1rem',
            background: '#ff4757',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          🌐 Erro API
        </button>

        <button 
          onClick={testBreadcrumb}
          style={{
            padding: '1rem',
            background: '#5352ed',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          🍞 Breadcrumb
        </button>

        <button 
          onClick={testTransaction}
          style={{
            padding: '1rem',
            background: '#1dd1a1',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          ⚡ Performance
        </button>

        <button 
          onClick={testCompleteError}
          style={{
            padding: '1rem',
            background: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          🎯 Teste Completo
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <button 
          onClick={runAllTests}
          style={{
            padding: '1.5rem 3rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
          }}
        >
          🚀 Executar Todos os Testes
        </button>
      </div>

      {testResults.length > 0 && (
        <div style={{
          background: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '8px',
          padding: '1.5rem'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#495057' }}>
            📋 Resultados dos Testes:
          </h3>
          <div style={{
            background: '#212529',
            color: '#f8f9fa',
            padding: '1rem',
            borderRadius: '6px',
            fontFamily: 'Monaco, Consolas, monospace',
            fontSize: '0.9rem',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {testResults.map((result, index) => (
              <div key={index} style={{ marginBottom: '0.5rem' }}>
                {result}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: '#e3f2fd',
        borderRadius: '8px',
        border: '1px solid #bbdefb'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#1565c0' }}>
          📖 Como verificar:
        </h3>
        <ol style={{ margin: 0, color: '#1976d2' }}>
          <li>Execute os testes acima</li>
          <li>Acesse o painel do Sentry</li>
          <li>Vá em "Issues" para ver os erros</li>
          <li>Vá em "Performance" para ver as transações</li>
          <li>Verifique se os contextos PABX estão aparecendo</li>
        </ol>
      </div>
    </div>
  );
}
