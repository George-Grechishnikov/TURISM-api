/** Сохраняет намерение «последовательный тур с AI» между перезагрузками /route */
export const SEQUENTIAL_AI_TOUR_SESSION_KEY = 'turizm.sequentialAiTour'

export function markSequentialAiTourSession() {
  try {
    sessionStorage.setItem(SEQUENTIAL_AI_TOUR_SESSION_KEY, '1')
  } catch {
    /* private mode / quota */
  }
}

export function clearSequentialAiTourSession() {
  try {
    sessionStorage.removeItem(SEQUENTIAL_AI_TOUR_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function hasSequentialAiTourSession() {
  try {
    return sessionStorage.getItem(SEQUENTIAL_AI_TOUR_SESSION_KEY) === '1'
  } catch {
    return false
  }
}
