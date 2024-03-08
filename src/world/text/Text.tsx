import opentype from 'opentype.js'

import { mat4 } from 'gl-matrix'
import { createCharacter } from '.'
import { Pose, Vector2, Vector3 } from '../types'

export type LayoutOptions = {
  font: opentype.Font
  lineHeight: number
  text: string
  width: number
  wordBreak?: 'all' | 'word'
  whiteSpace?: 'pre-line' | 'pre'
}

type LayoutResult = {
  character: string
  position: Vector3
}

const advanceWidth: Record<string, number> = {}

const getAdvanceWidth = (character: string, font: opentype.Font) => {
  if (!advanceWidth[character]) {
    advanceWidth[character] = font.getAdvanceWidth(character)
  }
  return advanceWidth[character]!
}

const layoutText = ({ font, lineHeight, text, width, wordBreak, whiteSpace }: LayoutOptions) => {
  let offset: Vector2 = [0, 0]

  const skip = (character: string) => whiteSpace === 'pre-line' && offset[0] === 0 && character === ' '

  if (wordBreak === 'word') {
    return text.split('\n').flatMap((line) => {
      const result = line.split(' ').flatMap((word) => {
        word = offset[0] === 0 ? word : ` ${word}`
        {
          // check word-size
          const size = word.split('').reduce((totalSize, character) => totalSize + getAdvanceWidth(character, font), 0)

          if (offset[0] + size > width) {
            offset = [0, offset[1] - lineHeight]
          }
        }

        return word
          .split('')
          .map((character) => {
            const position = [...offset, 0] as Vector3

            if (skip(character)) return

            offset[0] += getAdvanceWidth(character, font)

            if (character === ' ') {
              return undefined
            }

            return { character, position }
          })
          .filter((v) => v !== undefined) as LayoutResult[]
      })
      offset = [0, offset[1] - lineHeight]
      return result
    })
  }

  return text.split('\n').flatMap((line) => {
    const result = line
      .split('')
      .map((character) => {
        const position = [...offset, 0] as Vector3

        if (skip(character)) return

        offset[0] += getAdvanceWidth(character, font)

        if (wordBreak === 'all') {
          if (offset[0] > width) {
            offset = [0, offset[1] - lineHeight]
          }
        }

        if (character === ' ') {
          return undefined
        }

        return { character, position }
      })
      .filter((value) => value !== undefined) as LayoutResult[]
    offset = [0, offset[1] - lineHeight]
    return result
  })
}

export const Text = (props: Pose & LayoutOptions) => {
  const group = group({
    matrix: mat4.create() as Float32Array,
  })

  props.text
    .split('')
    .map((v) =>
      createCharacter({
        character: v,
        font: '',
        matrix: mat4.create() as Float32Array,
        color: new Float32Array([0, 0, 0]),
      })
    )

  return group
}
