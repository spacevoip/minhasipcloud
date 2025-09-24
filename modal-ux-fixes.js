// CORREÇÕES UX PARA MODAIS DE PLANO

// 1. MODAL RENOVAR PLANO - Linha ~2611
// ANTES:
// onChange={(e) => setPlanData({ ...planData, planId: e.target.value })}
// DEPOIS:
// onChange={(e) => updateValidityFromPlan(e.target.value)}

// 2. MODAL VINCULAR PLANO - Linha ~2870  
// ANTES:
// onChange={(e) => setPlanData({ ...planData, planId: e.target.value })}
// DEPOIS:
// onChange={(e) => updateValidityFromPlan(e.target.value)}

// 3. CAMPO VALIDADE MODAL RENOVAR - Linha ~2644
// ANTES:
// <input type="number" value={planData.validityDays} onChange={(e) => setPlanData({ ...planData, validityDays: e.target.value })} />
// DEPOIS:
// <input type="number" value={planData.validityDays} readOnly style={{ backgroundColor: 'rgba(249, 250, 251, 0.8)', color: '#6b7280', cursor: 'not-allowed' }} />

// 4. CAMPO VALIDADE MODAL VINCULAR - Linha ~2921
// ANTES:
// <input type="number" value={planData.validityDays} onChange={(e) => setPlanData({ ...planData, validityDays: e.target.value })} />
// DEPOIS:
// <input type="number" value={planData.validityDays} readOnly style={{ backgroundColor: 'rgba(249, 250, 251, 0.8)', color: '#6b7280', cursor: 'not-allowed' }} />

console.log('Correções UX para modais de plano definidas');
