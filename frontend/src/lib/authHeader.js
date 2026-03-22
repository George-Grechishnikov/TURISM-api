let tokenGetter = () => null

export function setAuthTokenGetter(fn) {
  tokenGetter = typeof fn === 'function' ? fn : () => null
}

export function getAuthToken() {
  try {
    return tokenGetter()
  } catch {
    return null
  }
}
