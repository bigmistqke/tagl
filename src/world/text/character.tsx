import earcut from 'earcut'
import opentype from 'opentype.js'
import { Atom } from '../../core/atom'
import { Object, Shape, ShapeOptions } from '../index'
import { vector2ArrayToVector3Array } from '../internal-utils'
import { commandsToEarcutFormats } from './utils'

const characterToData = (font: opentype.Font, value: string, flatness?: number) => {
  const glyph = font.charToGlyph(value)
  const commands = glyph.getPath(0, 0, 72).commands
  const earcutFormats = commandsToEarcutFormats(commands, flatness || 1)

  const totalVertices: number[] = []
  const totalIndices: number[] = []

  let offset = 0

  earcutFormats.forEach(({ vertices, holes, dimensions }) => {
    const size = vertices.length / 2

    totalVertices.push(...vector2ArrayToVector3Array(Array.from(vertices)))
    totalIndices.push(...earcut(vertices, holes, dimensions).map((v) => v + offset))

    offset += size
  })

  return {
    vertices: new Float32Array(totalVertices),
    uv: new Float32Array(totalVertices),
    indices: new Uint16Array(totalIndices),
  }
}

export type CharacterOptions = Omit<ShapeOptions, 'vertices' | 'uv' | 'indices'> & {
  font: opentype.Font
  value: string
  flattness?: number
}

export class Character extends Object {
  value: Atom<string>

  constructor(private options: CharacterOptions) {
    const value = new Atom(options.value)

    const shape = new Shape({
      ...characterToData(options.font, value.get(), options.flattness || 1),
      color: new Float32Array([0, 0, 0]),
      matrix: options.matrix,
    })

    super(shape)

    this.value = value

    const updateShape = () => {
      const data = this.characterToData()
      this.shape.vertices.set(data.vertices)
      this.shape.uv.set(data.uv)
      this.shape.indices?.set(data.indices)
    }

    this.value.subscribe(updateShape)
  }

  characterToData() {
    return characterToData(this.options.font, this.value.get(), this.options.flattness || 1)
  }
}
