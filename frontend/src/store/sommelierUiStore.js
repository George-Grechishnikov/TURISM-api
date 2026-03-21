import { create } from 'zustand'

/** Открытие сомелье с экрана маршрута (когда FAB перекрыт слоями карты) */
export const useSommelierUiStore = create((set) => ({
  openRequestId: 0,
  requestOpen: () => set((s) => ({ openRequestId: s.openRequestId + 1 })),
}))
