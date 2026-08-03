import { describe, expect, it } from 'vitest'
import { plannerActions, store, uiActions } from './store'

describe('store de apresentação', () => {
  it('alterna o tema sem persistência', () => {
    const before = store.getState().ui.theme
    store.dispatch(uiActions.toggleTheme())
    expect(store.getState().ui.theme).not.toBe(before)
  })

  it('mantém até sete dias e limita cada dia a cinco conteúdos', () => {
    store.dispatch(plannerActions.setSlots([]))
    for (let index = 0; index < 8; index += 1) store.dispatch(plannerActions.addSlot({ id: `slot-${index}`, format: 'post', source: 'ai', topic: 'Teste', date: `2030-05-${String(index + 6).padStart(2, '0')}`, time: '09:00', quantity: 9, slides: 1, cost: 5 }))
    expect(store.getState().planner.slots).toHaveLength(7)
    expect(store.getState().planner.slots.every((slot) => slot.quantity === 5 && slot.cost === 25)).toBe(true)
  })
})
