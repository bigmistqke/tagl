export const vector2ArrayToVector3Array = (array: number[]) =>
  array.reduce<number[]>((accumulator, current, index) => {
    accumulator.push(current)
    if ((index + 1) % 2 === 0) accumulator.push(0)
    return accumulator
  }, [])

// Linear interpolation function
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
