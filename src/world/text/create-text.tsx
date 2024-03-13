import { ShapeOptions } from '..'

export const createText = (
  options: Omit<ShapeOptions, 'vertices' | 'uv' | 'indices'> & {
    font: opentype.Font
    character: string
    flattness?: number
  }
) => {}
