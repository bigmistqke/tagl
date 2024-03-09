import { GL } from './gl'
import { ShaderToken, glsl } from './glsl'
import { buffer } from './tokens'
import { GLRecord, ProgramRecord, ProgramRegistry, glRegistry } from './virtualization/registries'
import { VirtualProgram, getVirtualProgram } from './virtualization/virtual-program'
import { BufferToken, GLLocation } from '/Users/bigmistqke/Documents/GitHub/tagl/src/core/types'

export type ProgramOptions<TMeta extends Record<string, any> | undefined> = {
  vertex: ReturnType<typeof glsl>
  fragment: ReturnType<typeof glsl>
  meta?: TMeta
} & ({ count: number; indices?: never } | { indices: number[]; count?: never })

export class Program<TMeta extends Record<string, any>> {
  private config: { gl: GL; virtualProgram: VirtualProgram }
  private configFragment: { locations: GLLocation[]; gl: GL; virtualProgram: VirtualProgram }
  private configVertex: { locations: GLLocation[]; gl: GL; virtualProgram: VirtualProgram }
  meta: TMeta

  private gl_record: GLRecord

  visible = false

  program: {
    fragment: ShaderToken
    webgl: WebGLProgram
    vertex: ShaderToken
    indices: number[] | undefined
    indicesBuffer: BufferToken | undefined
    count: number | undefined
  }

  constructor(public gl: GL, { vertex, fragment, count, indices, meta }: ProgramOptions<TMeta | undefined>) {
    this.meta = meta || {}
    this.gl_record = glRegistry.register(gl.ctx)

    const { program, locations } = ProgramRegistry.getInstance(gl).register(vertex, fragment).value as ProgramRecord

    const virtualProgram = getVirtualProgram(program)

    gl.ctx.useProgram(program)

    this.config = {
      gl,
      virtualProgram,
    }
    this.configVertex = {
      ...this.config,
      locations: locations.vertex,
    }
    this.configFragment = {
      ...this.config,
      locations: locations.fragment,
    }

    vertex.bind(this.configVertex)
    fragment.bind(this.configFragment)

    this.program = {
      webgl: program,
      vertex,
      fragment,
      count,
      indices,
      indicesBuffer: indices
        ? buffer(new Uint16Array(indices), {
            target: 'ELEMENT_ARRAY_BUFFER',
            usage: 'STATIC_DRAW',
          }).bind(this.config)
        : undefined,
    }
  }

  draw() {
    if (!this.visible) return
    if (this.gl_record.value.program !== this.program) {
      this.gl.ctx.useProgram(this.program)
      this.gl_record.value.program = this.program
    }
    this.program.indicesBuffer?.update(this.config)
    this.program.vertex.update(this.configVertex)
    this.program.fragment.update(this.configFragment)
    if (this.program.count) {
      this.gl.ctx.drawArrays(this.gl.ctx.TRIANGLES, 0, this.program.count)
    } else if (this.program.indices && this.program.indicesBuffer) {
      this.gl.ctx.drawElements(this.gl.ctx.TRIANGLES, this.program.indices.length, this.gl.ctx.UNSIGNED_SHORT, 0)
    }
  }
}
