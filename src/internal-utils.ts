const isDEV = true

export const TODO = (message: string) => {
  return () => {
    if (isDEV) throw message
    else console.error(message)
  }
}
