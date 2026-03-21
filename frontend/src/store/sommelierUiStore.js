import { create } from 'zustand'

/**
 * UI маршрута: запрос открыть сомелье + взаимное исключение с всплывающим ИИ-Чатом
 * (открыл один — второй закрывается).
 */
export const useSommelierUiStore = create((set) => ({
  openRequestId: 0,
  requestOpen: () => set((s) => ({ openRequestId: s.openRequestId + 1 })),

  sommelierCloseSignal: 0,
  signalCloseSommelier: () => set((s) => ({ sommelierCloseSignal: s.sommelierCloseSignal + 1 })),

  sequentialAiChatCloseSignal: 0,
  signalCloseSequentialAiChat: () =>
    set((s) => ({ sequentialAiChatCloseSignal: s.sequentialAiChatCloseSignal + 1 })),
}))
