import { mat4 } from 'gl-matrix'

import { GL, Pipeline, uniform } from '@tagl/core'
import { Uniform } from '@tagl/core/tokens'
import { Origin3D } from '@tagl/world/scene-graph'

export class Scene extends GL {
  camera = uniform.mat4(mat4.create())
  origin = new Origin3D(this)
  perspective: Uniform<mat4>
  pipeline = new Pipeline(this)

  constructor(public canvas: HTMLCanvasElement) {
    super(canvas)
    this.perspective = uniform.mat4(this._perspective())
    this.onResize(() => this.perspective.set(this._perspective))
    this.pipeline.add(this.origin.update.bind(this.origin)).add(super.render.bind(this))
  }

  render() {
    this.pipeline.run()
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
