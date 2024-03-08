import earcut from 'earcut'
import { mat4 } from 'gl-matrix'
import { shape, ShapeOptions } from '../index'
import { vector2ArrayToVector3Array } from '../internal-utils'
import { commandsToEarcutFormats } from './utils'

export const createCharacter = (
  options: Omit<ShapeOptions, 'vertices' | 'uv' | 'indices'> & {
    font: opentype.Font
    character: string
    flattness?: number
  }
) => {
  const character = () => {
    const glyph = options.font.charToGlyph(options.character)
    const commands = glyph.getPath(0, 0, 72).commands
    const earcutFormats = commandsToEarcutFormats(commands, options.flattness || 1)

    const totalVertices: number[] = []
    const totalIndices: number[] = []

    let offset = 0

    earcutFormats.forEach(({ vertices: vertices2D, holes, dimensions }) => {
      const size = vertices2D.length / 2

      const indices = earcut(vertices2D, holes, dimensions).map((v) => v + offset)
      const vertices = vector2ArrayToVector3Array(Array.from(vertices2D))

      totalVertices.push(...vertices)
      totalIndices.push(...indices)

      offset += size
    })

    return {
      vertices: new Float32Array(totalVertices),
      uv: new Float32Array(totalVertices),
      indices: totalIndices,
    }
  }

  return shape({
    ...character(),
    color: new Float32Array([0, 0, 0]),
    matrix: mat4.create() as Float32Array,
  })

  /* return (
    <Shape
      {...character()!}
      color={[0, 0, 0]}
      opacity={1}
      rotation={[Math.PI, 0, 0]}
      {...options}
    />
  ) */
}
