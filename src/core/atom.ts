import { GL, Program } from './gl'
import { Token } from './tokens'
import { AtomMappedReturnValues as AtomArrayReturnValues } from './types'

type SetterArgument<T> = T | ((value: T, flags: SetterFlags) => T)
type SetterFlags = {
  preventNotification: () => void
  preventRender: () => void
}

/**********************************************************************************/
/*                                                                                */
/*                                       Atom                                     */
/*                                                                                */
/**********************************************************************************/

/**
 * Represents a reactive data atom that manages subscriptions and rendering for WebGL programs.
 * The Atom class encapsulates a value of generic type `T`, offering a way to react to changes in this value
 * through subscriptions and rendering callbacks. It integrates closely with WebGL programs, providing lifecycle hooks
 * for rendering operations and program binding.
 *
 * @template T The type of the value encapsulated by the Atom.
 *
 * @example
 * Creating an atom and subscribing to its changes:
 * ```javascript
 * const countAtom = new Atom(0); // Initializes an atom with the value 0.
 *
 * const unsubscribe = countAtom.subscribe((newValue) => {
 *   console.log(`The new count is ${newValue}.`);
 * });
 *
 * // Increment the count. Logs "The new count is 1."
 * countAtom.set((currentValue) => currentValue + 1);
 *
 * // Stop listening to changes.
 * unsubscribe();
 * ```
 *
 * @example
 * Preventing unnecessary renders or notifications:
 * ```javascript
 * const configAtom = new Atom({ silent: false, render: true });
 *
 * configAtom.set((currentValue, flags) => {
 *   if (currentValue.silent) {
 *     flags.preventNotification();
 *   }
 *   if (!currentValue.render) {
 *     flags.preventRender();
 *   }
 *   return { ...currentValue, silent: !currentValue.silent };
 * });
 * ```
 *
 * @example
 * Using `onBeforeDraw` for rendering actions:
 * ```javascript
 * const visualAtom = new Atom({ color: 'blue' });
 *
 * visualAtom.onBeforeDraw(() => {
 *   console.log(`Preparing to draw with the color ${visualAtom.get().color}.`);
 * });
 * // Assuming `visualAtom` is associated with a renderable object,
 * // this callback would run before the object is drawn.
 * ```
 */
export class Atom<T> {
  /**
   * A cache of WebGL contexts to ensure each program is only bound once.
   * @private
   * @type {Set<GL>}
   */
  private cache = new Set<GL>()

  /**
   * Handlers to be called before each draw operation.
   * @private
   * @type {(() => void)[]}
   */
  private onBeforeDrawHandlers: (() => void)[] = []

  /**
   * Handlers to be called when a program is bound.
   * @private
   * @type {((program: Program) => void)[]}
   */
  private onBindHandlers: ((program: Program) => void)[] = []

  /**
   * A list of WebGL programs associated with this Atom.
   * @private
   * @type {Program[]}
   */
  private programs: Program[] = []

  /**
   * Callbacks to request a render operation.
   * @private
   * @type {(() => void)[]}
   */
  private requestRenderCallbacks: (() => void)[] = []

  /**
   * Controls whether subscribers should be notified upon value changes.
   * @private
   * @type {boolean}
   */
  private shouldNotify = true

  /**
   * Controls whether a render should be requested upon value changes.
   * @private
   * @type {boolean}
   */
  private shouldRender = true

  /**
   * Subscription callbacks that are notified when the Atom's value changes.
   * @private
   * @type {((value: T) => void)[]}
   */
  private subscriptions: ((value: T) => void)[] = []

  /**
   * Flags to control notification and rendering behavior dynamically.
   * @private
   * @type {SetterFlags}
   */
  private flags: SetterFlags = {
    preventNotification: () => (this.shouldNotify = false),
    preventRender: () => (this.shouldRender = false),
  }

  /**
   * Constructs a new Atom with an initial value.
   *
   * @param {T} value The initial value of the Atom.
   */
  constructor(public value: T) {}

  /**
   * Retrieves the current value of the Atom.
   *
   * @returns {T} The current value of the Atom.
   */
  get() {
    return this.value
  }

  /**
   * Updates the Atom's value and triggers notifications and render requests as appropriate.
   *
   * @param {SetterArgument<T>} _value The new value for the Atom, or a function to produce the new value.
   */
  set(_value: SetterArgument<T>, equals?: boolean) {
    const value = typeof _value === 'function' ? _value(this.value, this.flags) : _value

    if (equals && _value === this.value) return
    this.value = value

    if (this.shouldNotify) this.__.notify()
    if (this.shouldRender) this.__.requestRender()

    this.shouldNotify = true
    this.shouldRender = true
  }

  /**
   * Registers a callback to be called before each draw operation.
   *
   * @param {() => void} callback The callback to register.
   * @returns {() => void} A function to deregister the callback.
   */
  onBeforeDraw(callback: () => void) {
    this.onBeforeDrawHandlers.push(callback)
    this.programs.forEach((program) => program.onBeforeDraw(callback))
    return () => {
      console.error('TODO')
    }
  }

  /**
   * Registers a handler to be called when a program is bound.
   *
   * @param {(program: Program) => void} handler The handler to register.
   * @returns {() => void} A function to deregister the handler.
   */
  onBind(handler: (program: Program) => void) {
    this.onBindHandlers.push(handler)
    return () => {}
  }

  /**
   * Subscribes to changes in the Atom's value.
   *
   * @param {(value: T) => void} callback The subscription callback.
   * @returns {() => void} A function to unsubscribe the callback.
   */
  subscribe(callback: (value: T) => void) {
    this.subscriptions.push(callback)
    return () => {
      console.error('TODO')
      /* subscriptions.delete(callback) */
    }
  }

  /**
   * Internal methods for Atom lifecycle events: binding, requesting renders, and notifying subscribers.
   * @private
   */
  __ = {
    /**
     * Binds a WebGL program to this Atom, setting up necessary lifecycle hooks.
     * @param {Program} program The WebGL program to bind.
     * @param {() => false | void} [callback] Optional callback to execute on each render request.
     */
    bind: (program: Program, callback?: () => false | void) => {
      if (this.cache.has(program.gl)) return
      this.cache.add(program.gl)

      this.onBindHandlers.forEach((handler) => handler(program))

      this.programs.push(program)
      this.onBeforeDrawHandlers.forEach((handler) => program.onBeforeDraw(handler))

      this.requestRenderCallbacks.push(() => {
        if (callback?.() === false) return
        program.gl.requestRender()
      })
    },

    /**
     * Requests a render operation for all bound programs.
     */
    requestRender: () => {
      this.requestRenderCallbacks.forEach((callback) => callback())
    },

    /**
     * Notifies all subscribers of the Atom's current value.
     */
    notify: () => {
      this.subscriptions.forEach((subscription) => subscription(this.value))
    },
  }
}

export const atomize = <T>(value: T | Atom<T>) => {
  if (value instanceof Atom) return value
  else return new Atom(value)
}

/**********************************************************************************/
/*                                                                                */
/*                                     Effect                                     */
/*                                                                                */
/**********************************************************************************/

/**
 * Creates an effect that automatically runs a callback function whenever the specified dependencies change.
 * This is useful for creating reactive behaviors in applications, where certain actions need to be performed
 * in response to state changes. The effect also runs the callback immediately upon creation.
 *
 * @param {() => void} callback The callback function to run when any of the dependencies change.
 * This function can perform any actions needed in response to the change.
 * @param {(Atom | Token | BufferToken)[]} dependencies An array of dependencies to watch for changes.
 * The effect will only trigger the callback when one of these dependencies changes. The dependencies can be
 * instances of `Atom`, `Token`, or `BufferToken`, making this function versatile for different reactive use cases.
 *
 * @returns {() => void} A cleanup function that, when called, unsubscribes the effect from all its dependencies,
 * preventing the callback from being called again in the future.
 *
 * @example
 * ```javascript
 * // Assuming `countAtom` and `nameAtom` are previously defined Atoms.
 * const logEffect = effect(() => {
 *   console.log(`Count is now ${countAtom.get()}, name is ${nameAtom.get()}.`);
 * }, [countAtom, nameAtom]);
 *
 * // Later, if you want to stop this effect:
 * logEffect(); // Unsubscribes the effect, preventing further callback invocations.
 * ```
 *
 * This function simplifies the creation of reactive patterns, allowing developers to easily set up dynamic
 * responses to state changes in their applications.
 */

export const effect = <const TDeps extends (Atom<any> | Token<any>)[]>(
  dependencies: TDeps,
  callback: (values: AtomArrayReturnValues<TDeps>) => void
) => {
  const values = Array.from({ length: dependencies.length }) as AtomArrayReturnValues<TDeps>
  const getLatestDependencies = () => {
    for (let i = 0; i < dependencies.length; i++) {
      values[i] = dependencies[i]!.get()
    }
    return values
  }
  const cleanups = dependencies.map((dependency) => dependency.subscribe(() => callback(getLatestDependencies())))
  callback(getLatestDependencies())
  return () => cleanups.forEach((cleanup) => cleanup())
}

/**********************************************************************************/
/*                                                                                */
/*                                       Memo                                     */
/*                                                                                */
/**********************************************************************************/

export const memo = <TValue, const TDeps extends (Atom<any> | Token<any>)[]>(
  dependencies: TDeps,
  callback: (values: AtomArrayReturnValues<TDeps>) => TValue
) => {
  const atom = new Atom<TValue>(null!)
  effect(dependencies, (dependencies) => atom.set(callback(dependencies)))
  return atom
}
