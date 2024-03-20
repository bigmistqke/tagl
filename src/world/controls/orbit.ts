import { mat4, vec2, vec3 } from 'gl-matrix'

import { atom, effect } from '@tagl/core/atom'
import { Scene } from '@tagl/world'

export const orbit = (
  scene: Scene,
  _config?: {
    near?: number
    far?: number
    target?: vec3
    up?: vec3
    initialRadius?: number
  }
) => {
  const config = {
    target: [0, 0, 0] as vec3,
    up: [0, 1, 0] as vec3,
    near: 1,
    far: 50,
    ..._config,
  }

  const rotation = atom<vec2>([0, 0])
  const radius = atom(config?.initialRadius || 10)

  const _matrix = mat4.create()

  const matrix = () => {
    const [theta, phi] = rotation.get() as [number, number]

    const eye: vec3 = [
      radius.get() * Math.sin(theta) * Math.cos(phi),
      radius.get() * Math.sin(phi),
      radius.get() * Math.cos(theta) * Math.cos(phi),
    ]

    const target: vec3 = config.target
    const up: vec3 = [0, 1, 0]

    mat4.lookAt(_matrix, eye, target, up)

    return _matrix
  }

  let start: { x: number; y: number }
  const onMouseDown = (e: MouseEvent) => {
    start = {
      x: e.clientX,
      y: e.clientY,
    }
    const onMouseUp = (e: MouseEvent) => window.removeEventListener('mousemove', onMouseMove)
    const onMouseMove = (e: MouseEvent) => {
      const now = {
        x: e.clientX,
        y: e.clientY,
      }
      const delta = {
        x: start.x - now.x,
        y: start.y - now.y,
      }
      start = now
      rotation.set((rotation) => {
        rotation[0] += delta.x / 200
        rotation[1] -= delta.y / 200
        return rotation
      })
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }
  window.addEventListener('mousedown', onMouseDown)

  const onWheel = (e: WheelEvent) => {
    radius.set((radius) => Math.min(config.far, Math.max(config.near, radius + e.deltaY / 1000)))
    e.preventDefault()
  }
  window.addEventListener('wheel', onWheel, { passive: false })

  effect(() => {
    scene.camera.set(matrix())
  }, [rotation, radius])
}
