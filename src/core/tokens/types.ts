/**********************************************************************************/
/*                                       TYPES                                    */
/**********************************************************************************/

import { $TYPE } from '..'

/* VARIABLE: UNIFORM + ATTRIBUTE */
export type Variable<TValueDefault, TTOptionsDefault = unknown, TProperties = {}> = <
  const TValue extends TValueDefault,
  const TTOptions extends TTOptionsDefault
>(
  value: TValue | Atom<TValue>,
  options?: Partial<TTOptions>
) => Token<TValue>

export type Token<T = Float32Array, TLocation = WebGLUniformLocation | number> = {
  [$TYPE]: 'token'
  set: Setter<T>
  get: Accessor<T>
  onBeforeDraw: (callback: () => void) => () => void
  onBind: (handler: (program: Program) => void) => () => void
  subscribe: (callback: (value: T) => void) => () => void
  __: {
    bind: (program: Program, location: TLocation) => Token<T, TLocation>
    getLocation: (program: Program, name: string) => TLocation
    notify: () => void
    requestRender: () => void
    template: (name: string) => string | undefined
    update: (program: Program, location: TLocation) => void
  }
}
