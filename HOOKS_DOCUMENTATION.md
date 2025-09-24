# Custom Hooks Documentation - Agent Dashboard Refactoring

## 📋 Overview

Durante a **Fase 2** da refatoração do dashboard do agente, foram criados **3 custom hooks** para extrair lógica complexa e melhorar a organização do código. Devido a conflitos de variáveis no arquivo principal, os hooks foram temporariamente desabilitados, mas estão prontos para implementação futura.

---

## 🎯 Hooks Criados

### 1. **useWebRTC.ts** - Gerenciamento WebRTC
**Localização**: `/src/hooks/useWebRTC.ts`  
**Linhas**: ~300 linhas  
**Responsabilidade**: Gerenciar conexões WebRTC, chamadas e estados relacionados

#### **Estados Gerenciados:**
- `webrtcConnected` - Status da conexão
- `webrtcRegistered` - Status do registro SIP
- `webrtcConnecting` - Estado de carregamento
- `callStatus` - Status da chamada ('idle' | 'calling' | 'ringing' | 'connected')
- `callTarget` - Alvo da chamada
- `callDuration` - Duração da chamada
- `isMuted` - Estado do mute
- `recentCalls` - Histórico de chamadas

#### **Funções Expostas:**
```typescript
const {
  // Estados
  webrtcConnected,
  webrtcRegistered,
  callStatus,
  callDuration,
  isMuted,
  recentCalls,
  
  // Ações
  connectWebRTC,
  disconnectWebRTC,
  makeWebRTCCall,
  hangupWebRTCCall,
  toggleMute,
  formatCallDuration
} = useWebRTC(config);
```

#### **Configuração:**
```typescript
interface WebRTCConfig {
  domain: string;
  username: string;
  password: string;
  displayName?: string;
}
```

---

### 2. **useAgentData.ts** - Dados do Agente
**Localização**: `/src/hooks/useAgentData.ts`  
**Linhas**: ~120 linhas  
**Responsabilidade**: Gerenciar dados do agente e edição de CallerID

#### **Estados Gerenciados:**
- `agentData` - Dados completos do agente
- `loading` - Estado de carregamento
- `error` - Mensagens de erro
- `stats` - Estatísticas formatadas para cards
- `editingCallerId` - Estado de edição do CallerID
- `tempCallerId` - Valor temporário durante edição
- `savingCallerId` - Estado de salvamento

#### **Funções Expostas:**
```typescript
const {
  // Dados
  agentData,
  loading,
  error,
  stats,
  
  // CallerID editing
  editingCallerId,
  tempCallerId,
  savingCallerId,
  
  // Ações
  loadAgentData,
  saveCallerId,
  startEditingCallerId,
  cancelEditingCallerId,
  setTempCallerId
} = useAgentData();
```

#### **Stats Geradas:**
- Ramal do agente
- Status online/offline
- Chamadas hoje
- CallerID (BINA) editável

---

### 3. **useToast.ts** - Sistema de Notificações
**Localização**: `/src/hooks/useToast.ts`  
**Linhas**: ~30 linhas  
**Responsabilidade**: Gerenciar notificações toast

#### **Estados Gerenciados:**
- `toast` - Notificação atual

#### **Funções Expostas:**
```typescript
const {
  toast,
  showToast,
  hideToast
} = useToast();

// Uso
showToast('Mensagem de sucesso', 'success');
showToast('Erro ocorreu', 'error');
```

#### **Tipos Suportados:**
- `success` - Verde
- `error` - Vermelho  
- `info` - Azul
- `warning` - Amarelo

---

## 🚧 Status Atual

### ✅ **Completado:**
- [x] Hooks criados e testados individualmente
- [x] Interfaces TypeScript definidas
- [x] Lógica extraída do dashboard principal
- [x] Documentação completa

### ⏸️ **Pausado:**
- [ ] Implementação no dashboard (conflitos de variáveis)
- [ ] Testes de integração
- [ ] Refatoração incremental

---

## 🔄 Implementação Futura

### **Estratégia Recomendada:**

#### **Opção 1: Refatoração Gradual**
1. Criar novo arquivo `dashboard-v2.tsx`
2. Implementar hooks um por vez
3. Migrar funcionalidades gradualmente
4. Substituir arquivo original

#### **Opção 2: Implementação Direta**
1. Remover estados duplicados do dashboard
2. Implementar hooks diretamente
3. Corrigir conflitos conforme aparecem
4. Testar funcionalidade completa

#### **Opção 3: Componentes Isolados**
1. Criar componentes maiores que usam os hooks
2. Substituir seções do dashboard por componentes
3. Manter compatibilidade total
4. Migração transparente

---

## 📊 Benefícios Esperados

### **Redução de Código:**
- **useWebRTC**: ~300 linhas extraídas
- **useAgentData**: ~120 linhas extraídas  
- **useToast**: ~50 linhas extraídas
- **Total**: ~470 linhas organizadas em hooks reutilizáveis

### **Melhorias:**
- **Testabilidade**: Hooks podem ser testados isoladamente
- **Reutilização**: Hooks podem ser usados em outras páginas
- **Manutenibilidade**: Lógica organizada por responsabilidade
- **Performance**: Estados isolados reduzem re-renders

---

## 🧪 Como Testar

### **Teste Individual dos Hooks:**
```typescript
// Teste useWebRTC
const config = {
  domain: 'sip.example.com',
  username: '1001',
  password: 'senha123'
};

const webrtc = useWebRTC(config);
// Testar conexão, chamadas, etc.

// Teste useAgentData
const agentData = useAgentData();
// Testar carregamento, edição CallerID, etc.

// Teste useToast
const toast = useToast();
toast.showToast('Teste', 'success');
```

### **Teste de Integração:**
```typescript
// Em um componente de teste
function TestDashboard() {
  const webrtc = useWebRTC(config);
  const agent = useAgentData();
  const toast = useToast();
  
  // Testar interações entre hooks
  // Verificar se não há conflitos
  // Validar funcionalidade completa
}
```

---

## 🎯 Próximos Passos

1. **Decidir estratégia de implementação** (Opção 1, 2 ou 3)
2. **Resolver conflitos de variáveis** no dashboard atual
3. **Implementar hooks gradualmente** com testes
4. **Validar funcionalidade** após cada implementação
5. **Documentar mudanças** e criar guias de uso

---

## 📝 Notas Técnicas

### **Dependências:**
- React hooks (useState, useEffect, useCallback)
- agentAuthService para dados do agente
- JsSIP para WebRTC (window.JsSIP)
- localStorage para persistência

### **Compatibilidade:**
- ✅ React 18+
- ✅ TypeScript
- ✅ Next.js
- ✅ Navegadores modernos

### **Limitações Atuais:**
- Hooks não implementados no dashboard principal
- Conflitos de variáveis precisam ser resolvidos
- Testes de integração pendentes

---

**Esta documentação serve como guia para implementação futura dos custom hooks na Fase 2 da refatoração do dashboard do agente.**
