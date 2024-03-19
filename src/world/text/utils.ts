import { adaptiveSubdivideCubicBezierPoints, adaptiveSubdivideQuadraticBezierPoints } from '../curves'
import { Vector2 } from '../types'

export const isHole = (commands: opentype.PathCommand[], inverted: boolean) => {
  let area = 0
  const path = commands.filter((v) => v.type !== 'Z') as Exclude<opentype.PathCommand, { type: 'Z' }>[]

  for (let i = 0; i < path.length - 1; i++) {
    const point1 = path[i]!
    const point2 = path[i + 1]!
    area += point1.x * point2.y - point2.x * point1.y
  }
  area += path[path.length - 1]!.x * path[0]!.y - path[0]!.x * path[path.length - 1]!.y

  const winding = area / 2 > 0 // winding order is counter-clockwise

  // XOR
  return (winding && !inverted) || (!winding && inverted)
}

export const getCoordinatesOfPath = (path: opentype.PathCommand[], flatness: number) => {
  let current: Vector2 | undefined = undefined
  const vertices: number[] = []

  for (let i = 0; i < path.length; i++) {
    const command = path[i]!
    if (command.type === 'Z') continue
    switch (command.type) {
      case 'M':
      case 'L':
        current = [command.x, command.y]
        vertices.push(...current)
        break
      case 'C':
        if (!current) {
          console.error('expected current')
          break
        }
        vertices.push(
          ...adaptiveSubdivideCubicBezierPoints(
            current,
            [command.x1, command.y1],
            [command.x2, command.y2],
            [command.x, command.y],
            flatness
          )
        )
        current = [command.x, command.y]
        break
      case 'Q':
        if (!current) {
          console.error('expected current')
          break
        }
        vertices.push(
          ...adaptiveSubdivideQuadraticBezierPoints(current, [command.x1, command.y1], [command.x, command.y], flatness)
        )
        current = [command.x, command.y]
        break
    }
  }

  return vertices
}

export const splitCanvasCommands = (commands: opentype.PathCommand[]) => {
  const paths: opentype.PathCommand[][] = []
  let current: opentype.PathCommand[] = []

  const pushCurrent = () => {
    if (current.length > 0) {
      paths.push([...current])
    }
    current = []
  }

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i]!
    if (command.type === 'Z') {
      pushCurrent()
      continue
    }
    current.push(command)
  }
  pushCurrent()

  return paths
}

type EarcutFormat = {
  vertices: Float32Array
  holes: number[]
  dimensions: number
}

export const commandsToEarcutFormats = (commands: opentype.PathCommand[], flatness: number) => {
  const paths = splitCanvasCommands(commands)

  const earcutFormats: EarcutFormat[] = []
  let current: {
    vertices: number[]
    holes: number[]
  } = {
    vertices: [],
    holes: [],
  }

  const pushCurrent = () => {
    earcutFormats.push({
      vertices: new Float32Array(current.vertices),
      holes: current.holes,
      dimensions: 2,
    })
    current = {
      vertices: [],
      holes: [],
    }
  }

  let inverted = false

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!

    if (isHole(path, inverted)) {
      if (i === 0) {
        inverted = true
      } else {
        current.holes.push(current.vertices.length / 2)
      }
    } else if (i !== 0) {
      pushCurrent()
    }
    current.vertices.push(...getCoordinatesOfPath(path, flatness))
  }
  pushCurrent()

  return earcutFormats
}
