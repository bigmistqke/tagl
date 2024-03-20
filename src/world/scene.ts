import { mat4 } from 'gl-matrix'

import { GL, uniform } from '@tagl/core'
import { Token } from '@tagl/core/tokens'
import { Origin3D } from '@tagl/world/scene-graph'

export class Scene extends GL {
  camera = uniform.mat4(mat4.create())
  node = new Origin3D(this)
  perspective: Token<mat4>

  constructor(public canvas: HTMLCanvasElement) {
    super(canvas)
    this.perspective = uniform.mat4(this._perspective())
    this.onResize(() => this.perspective.set(this._perspective))
    this.onBeforeRender(this.node.update.bind(this.node))
  }

  private _perspective = (matrix?: mat4) =>
    mat4.perspective(
      matrix || mat4.create(),
      Math.PI / 2,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0.1,
      1000
    )
}
