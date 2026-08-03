export const MANUAL_SCHEDULE_CREDIT_COST = 2

export const CREDIT_PACKAGES = [
  { id: 'boost-50', name: 'Impulso', credits: 50, price: 19.9, description: 'Até 25 agendamentos manuais', featured: false },
  { id: 'boost-150', name: 'Crescimento', credits: 150, price: 49.9, description: 'Até 75 agendamentos manuais', featured: true },
  { id: 'boost-400', name: 'Escala', credits: 400, price: 109.9, description: 'Até 200 agendamentos manuais', featured: false },
] as const

export type CreditPackageId = typeof CREDIT_PACKAGES[number]['id']
