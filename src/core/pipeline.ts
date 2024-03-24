import { GL } from './'

type PipeLineArray = ((gl: TGL) => void)[]

export class Pipeline<TGL extends GL> {
  private pipeline: PipeLineArray = []
  constructor(public gl: TGL) {}
  add(callback: (gl: TGL) => void): Pipeline<TGL> {
    this.pipeline.push(callback)
    return this
  }
  remove(callback: (gl: TGL) => void): Pipeline<TGL> {
    const index = this.pipeline.findIndex((value) => value === callback)
    if (index !== -1) this.pipeline.splice(index, 1)
    return this
  }
  set(value: PipeLineArray | ((pipeline: PipeLineArray) => PipeLineArray)) {
    if (typeof value === 'function') {
      this.pipeline = value(this.pipeline)
    } else {
      this.pipeline = value
    }
    return this
  }
  run() {
    for (let i = 0; i < this.pipeline.length; i++) {
      this.pipeline[i]!(this.gl)
    }
    return this
  }
}
