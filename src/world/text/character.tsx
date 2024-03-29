import { Atom, Effect } from '@tagl/core'
import earcut from 'earcut'
import opentype from 'opentype.js'
import { Shape, ShapeOptions } from '../index'
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

export class Character extends Shape {
  value: Atom<string>

  constructor(private options: CharacterOptions) {
    const value = new Atom(options.value)

    super({
      ...characterToData(options.font, value.get(), options.flattness || 1),
      color: new Float32Array([0, 0, 0]),
      matrix: options.matrix,
    })

    this.value = value

    new Effect([this.value], () => {
      const data = this.characterToData()
      this.vertices.set(data.vertices)
      this.uv.set(data.uv)
      this.indices?.set(data.indices)
    })
  }

  characterToData() {
    return characterToData(this.options.font, this.value.get(), this.options.flattness || 1)
  }
}
