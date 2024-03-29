/**
 * Signal-like reactive core of `tagl`.
 * The key differences with signals are:
 * - explicit dependency graph
 * - pure derivations and effects: setting `Atom` inside `Atom` or `Effect` is explicitly forbidden, Atom.derive instead.
 * - manual cleanup
 *
 * Algorithm is inspired by @modderme's article on his signal-library `reactively`.
 * @article https://github.com/modderme123/reactively
 * @article https://dev.to/modderme123/super-charging-fine-grained-reactive-performance-47ph
 */

/**********************************************************************************/
/*                                                                                */
/*                                      utils                                     */
/*                                                                                */
/**********************************************************************************/

const returnValues = <TDeps extends Atom[]>(dependencies: TDeps, arr: any[]) => {
  for (let i = 0; i < dependencies.length; i++) {
    arr[i] = dependencies[i]!.get()
  }
  return arr
}

/**********************************************************************************/
/*                                                                                */
/*                                      types                                     */
/*                                                                                */
/**********************************************************************************/

type DepReturnValues<TDeps extends Atom[]> = {
  [T in keyof TDeps]: TDeps[T]['value']
}

type Computation<TValue, TDeps extends Atom[]> = (
  dependencies: DepReturnValues<TDeps>,
  previous?: TValue
) => TValue

/**********************************************************************************/
/*                                                                                */
/*                                     Atom                                    */
/*                                                                                */
/**********************************************************************************/

export class Atom<T = any, const TDeps extends Atom[] = any> {
  flag: 'clean' | 'dirty' | 'update' = 'clean'
  observers: (Atom | Effect<Atom[]>)[] = []
  value: T
  dependencies: Atom[]
  fn: Computation<T, TDeps> | undefined

  constructor(value: T)
  constructor(dependencies: TDeps, fn: Computation<T, TDeps>, initialValue?: T)
  constructor(dependenciesOrValue: T | TDeps, fn?: Computation<T, TDeps>, initialValue?: T) {
    if (fn) {
      this.value = fn(
        (dependenciesOrValue as TDeps)!.map((v) => v.get(), initialValue) as DepReturnValues<TDeps>,
        initialValue
      )
      this.dependencies = dependenciesOrValue as TDeps
      this.dependencies.forEach((dependency) => dependency.addObserver(this))
      this.fn = fn
    } else {
      this.value = dependenciesOrValue as T
      this.dependencies = []
    }
  }
  set(value: T | ((value: T) => T)) {
    if (CURRENT) {
      // console.error('updating signal inside effect is not allowed, use Atom instead')
    }
    this.value = typeof value === 'function' ? value(this.value) : value
    flagObservers(this)
  }
  get() {
    if (this.flag === 'update') resolveDependencies(this)
    return this.value
  }
  addObserver(node: Atom | Effect<Atom[]>) {
    this.observers.push(node)
  }
  removeObserver(node: Atom | Effect<Atom[]>) {
    const index = this.observers.findIndex((observer) => observer === node)
    if (index !== -1) this.observers.splice(index, 1)
    if (this.observers.length === 0) this.cleanup()
  }

  private _resolvedDependencies = []
  resolve() {
    this.flag = 'clean'
    if (!this.fn) return
    CURRENT = this
    this.value = this.fn(
      returnValues(this.dependencies, this._resolvedDependencies) as DepReturnValues<TDeps>,
      this.value
    )
    CURRENT = undefined
  }
  cleanup() {
    this.cleanupDependencies()
    this.cleanupObservers()
  }
  cleanupDependencies() {
    for (let i = 0; i < this.dependencies.length; i++) {
      this.dependencies[i]!.removeObserver(this)
    }
  }
  cleanupObservers() {
    for (let i = 0; i < this.observers.length; i++) {
      this.observers[i]!.removeDependency(this)
    }
  }
  removeDependency(node: Atom | Atom) {
    const index = this.dependencies.findIndex((observer) => observer === node)
    if (index !== -1) this.dependencies.splice(index, 1)
    if (this.dependencies.length === 0) this.cleanup()
  }
  derive<const TDeps extends Atom[]>(dependencies: TDeps, fn: Computation<T, TDeps>) {
    this.cleanupDependencies()
    this.dependencies = dependencies
    this.dependencies.forEach((dependency) => dependency.addObserver(this))
    this.fn = fn
    this.value = fn(
      (dependencies as TDeps)!.map((v) => v.get()) as DepReturnValues<TDeps>,
      this.value
    )
    flagObservers(this)
  }
}

export const atomize = <T>(value: T | Atom<T>) => (value instanceof Atom ? value : new Atom(value))

/**********************************************************************************/
/*                                                                                */
/*                                     Effect                                     */
/*                                                                                */
/**********************************************************************************/

let CURRENT: Effect<any> | Atom | undefined

export class Effect<const TDeps extends Atom[]> {
  flag: 'clean' | 'dirty' | 'update' = 'clean'
  constructor(
    public dependencies: TDeps,
    public fn: Computation<void, TDeps>,
    public observers?: Atom[]
  ) {
    let shouldUpdate = false

    for (let i = 0; i < this.dependencies.length; i++) {
      const dependency = this.dependencies[i]!
      if (dependency.flag !== 'clean') shouldUpdate = true
      dependency.addObserver(this)
    }

    if (shouldUpdate) {
      scheduleEffect(this)
    } else {
      this.resolve()
    }
  }
  private _resolvedDependencies: any[] = []
  resolve() {
    CURRENT = this
    this.fn(returnValues(this.dependencies, this._resolvedDependencies) as DepReturnValues<TDeps>)
    CURRENT = undefined
  }
  cleanup() {
    for (let i = 0; i < this.dependencies.length; i++) {
      this.dependencies[i]!.removeObserver(this)
    }
  }
  removeDependency(node: Atom | Atom) {
    const index = this.dependencies.findIndex((observer) => observer === node)
    if (index !== -1) this.dependencies.splice(index, 1)
    if (this.dependencies.length === 0) this.cleanup()
  }
}

/**********************************************************************************/
/*                                                                                */
/*                              scheduling-utilities                              */
/*                                                                                */
/**********************************************************************************/

const QUEUE = new Set<Effect<Atom[]> | Atom>()
let RUN_IS_SCHEDULED = false

const scheduleEffect = (effect: Effect<Atom[]>) => {
  QUEUE.add(effect)
  if (!RUN_IS_SCHEDULED) {
    RUN_IS_SCHEDULED = true
    queueMicrotask(flushEffects)
  }
}

const flushEffects = () => {
  RUN_IS_SCHEDULED = false
  QUEUE.forEach((effect) => resolveDependencies(effect))
  QUEUE.clear()
}

const flagObservers = (source: Atom) => {
  if (source.flag !== 'clean') return
  source.flag = 'dirty'
  iterateFlagObservers(source.observers)
}
const iterateFlagObservers = (observers: (Atom | Effect<any[]>)[]) => {
  for (let i = 0; i < observers.length; i++) {
    const observer = observers[i]!

    if (observer.observers) {
      if (observer.flag === 'clean') {
        observer.flag = 'update'
        iterateFlagObservers(observer.observers)
      }
    } else {
      scheduleEffect(observer)
    }
  }
}

const resolveDependencies = (node: Effect<Atom[]> | Atom) => {
  iterateResolveDependency(node.dependencies)
  node.resolve()
}
const iterateResolveDependency = (dependencies: Atom[]) => {
  for (let i = 0; i < dependencies.length; i++) {
    const dependency = dependencies[i]!
    if (dependency.flag !== 'clean') {
      if (dependency.dependencies.length > 0) {
        iterateResolveDependency(dependency.dependencies)
      }
      dependency.resolve()
    }
  }
}
