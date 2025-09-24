// Modificações necessárias para os modais de renovar e vincular plano

// 1. Ajustar função handleRenewPlan para selecionar plano atual e definir validade automática
const handleRenewPlan = (user) => {
  setSelectedUser(user);
  
  // Encontrar o plano atual do usuário para definir validade automática
  const currentPlan = availablePlans.find(p => p.id === user.planId);
  const defaultValidityDays = currentPlan?.periodDays?.toString() || '30';
  
  setPlanData({
    planId: user.planId || '',
    validityDays: defaultValidityDays,
    note: ''
  });
  setShowRenewPlanModal(true);
};

// 2. Função para atualizar validade automaticamente baseada no plano selecionado
const updateValidityFromPlan = (planId) => {
  const selectedPlan = availablePlans.find(p => p.id === planId);
  const validityDays = selectedPlan?.periodDays?.toString() || '30';
  setPlanData(prev => ({ ...prev, planId, validityDays }));
};

// 3. Select do modal de renovar plano deve usar updateValidityFromPlan
// onChange={(e) => updateValidityFromPlan(e.target.value)}

// 4. Select do modal de vincular plano deve usar updateValidityFromPlan
// onChange={(e) => updateValidityFromPlan(e.target.value)}

// 5. Campo de validade deve ser readOnly em ambos os modais
// readOnly
// backgroundColor: 'rgba(249, 250, 251, 0.8)'
// color: '#6b7280'
// cursor: 'not-allowed'
