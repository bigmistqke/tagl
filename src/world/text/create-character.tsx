import earcut from 'earcut'
import { mat4 } from 'gl-matrix'
import opentype from 'opentype.js'
import { Atom, Token, atom } from '../../core/tokens'
import { Scene, Shape, ShapeOptions, createShape } from '../index'
import { vector2ArrayToVector3Array } from '../internal-utils'
import { commandsToEarcutFormats } from './utils'

export type CharacterOptions = Omit<ShapeOptions, 'vertices' | 'uv' | 'indices'> & {
  font: opentype.Font
  character: string
  flattness?: number
}

class Character {
  shape: Shape
  character: Atom<string>
  matrix: Token<mat4>

  constructor(private options: CharacterOptions) {
    this.character = atom(options.character)

    this.shape = createShape({
      ...this.characterToData(),
      color: new Float32Array([0, 0, 0]),
      matrix: options.matrix,
    })

    this.matrix = this.shape.matrix

    const updateShape = () => {
      const data = this.characterToData()
      this.shape.vertices.set(data.vertices)
      this.shape.uv.set(data.uv)
      this.shape.indices?.set(data.indices)
    }

    this.character.subscribe(updateShape)
  }

  bind(object: Shape | Scene | { shape: Shape }) {
    return this.shape.bind('shape' in object ? object.shape : object)
  }
  unbind() {
    return this.shape.unbind()
  }

  characterToData() {
    const glyph = this.options.font.charToGlyph(this.character.get())
    const commands = glyph.getPath(0, 0, 72).commands
    const earcutFormats = commandsToEarcutFormats(commands, this.options.flattness || 1)

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
}

export const createCharacter = (options: CharacterOptions) => {
  return new Character(options)
  /* const character = atom(options.character)

  const characterToData = () => {
    const glyph = options.font.charToGlyph(character.get())
    const commands = glyph.getPath(0, 0, 72).commands
    const earcutFormats = commandsToEarcutFormats(commands, options.flattness || 1)

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

  const shape = createShape({
    ...characterToData(),
    color: new Float32Array([0, 0, 0]),
    matrix: options.matrix,
  })

  const updateShape = () => {
    const data = characterToData()

    shape.vertices.set(data.vertices)
    shape.uv.set(data.uv)
    shape.indices.set(data.indices)
  }

  character.subscribe(updateShape)

  return {
    ...shape,
    character,
  } */
}
