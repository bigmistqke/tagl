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

    if (IS_BATCHING) {
      if (this.shouldNotify) scheduleUpdate(this.__.notify)
      if (this.shouldRender) scheduleUpdate(this.__.requestRender)
    } else {
      if (this.shouldNotify) this.__.notify()
      if (this.shouldRender) this.__.requestRender()
    }

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
    for (let i = 0; i < this.programs.length; i++) {
      this.programs[i]!.onBeforeDraw(callback)
    }
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

      for (let i = 0; i < this.onBindHandlers.length; i++) {
        this.onBindHandlers[i]!(program)
      }

      this.programs.push(program)

      for (let i = 0; i < this.onBeforeDrawHandlers.length; i++) {
        program.onBeforeDraw(this.onBeforeDrawHandlers[i]!)
      }

      this.requestRenderCallbacks.push(() => {
        if (callback?.() === false) return
        program.gl.requestRender()
      })
    },

    /**
     * Requests a render operation for all bound programs.
     */
    requestRender: () => {
      for (let i = 0; i < this.requestRenderCallbacks.length; i++) {
        this.requestRenderCallbacks[i]!()
      }
    },

    /**
     * Notifies all subscribers of the Atom's current value.
     */
    notify: () => {
      for (let i = 0; i < this.subscriptions.length; i++) {
        this.subscriptions[i]!(this.value)
      }
    },
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                     atomize                                    */
/*                                                                                */
/**********************************************************************************/

export const atomize = <T>(value: T | Atom<T>) => {
  if (value instanceof Atom) return value
  else return new Atom(value)
}

/**********************************************************************************/
/*                                                                                */
/*                                      batch                                     */
/*                                                                                */
/**********************************************************************************/

/**
 * Executes a given callback function and batches any updates scheduled during its execution. If the function is called
 * within an existing batching context, the callback is executed immediately without starting a new batch. This function
 * ensures that updates affecting the state are batched together, optimizing performance by minimizing the number of
 * recalculations for derived states or re-renderings that might otherwise be triggered by each individual update.
 *
 * The function manages a queue of updates. When not already batching, it processes all updates in the queue, including
 * those added during the processing of the current batch. This continues until the queue is empty, ensuring all updates
 * are applied. Useful for optimizing reactive systems where updates are frequent and may benefit from being applied
 * together in a single operation or rendering cycle.
 *
 * @param {() => void} callback The function to execute, potentially scheduling updates that will be batched together.
 *
 * @example
 * // Assuming we have an Atom class that can schedule updates, and a memo function that recalculates
 * // derived states only when its dependencies change.
 * const counterAtom = new Atom(0);
 *
 * // A memoized function that calculates the square of the counter.
 * const squaredCounter = memo([counterAtom], ([count]) => count * count);
 *
 * // Listener to log the squaredCounter value, illustrating that memo is recalculated only once.
 * squaredCounter.subscribe(value => console.log('Squared value is now:', value));
 *
 * // Batch multiple increment operations into a single update.
 * batch(() => {
 *   counterAtom.set(counterAtom.get() + 1);
 *   counterAtom.set(counterAtom.get() + 1);
 *   counterAtom.set(counterAtom.get() + 1);
 * });
 *
 * // Output will be 'Squared value is now: 9', showing the counter has been incremented three times,
 * // but the squaredCounter memo has been recalculated only once after all updates.
 */

let BATCHED_UPDATES: Set<() => void>[] = [new Set<() => void>()]
let IS_BATCHING = false

const scheduleUpdate = (callback: () => void) => BATCHED_UPDATES[0]!.add(callback)
export const batch = (callback: () => void) => {
  IS_BATCHING = true
  callback()
  while (BATCHED_UPDATES[0]!.size > 0 || BATCHED_UPDATES.length > 1) {
    BATCHED_UPDATES.push(new Set())
    const batchedUpdate = BATCHED_UPDATES.shift()!
    batchedUpdate.forEach((update) => update())
  }
  IS_BATCHING = false
}

/**********************************************************************************/
/*                                                                                */
/*                                     effect                                     */
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
  callback: () => void
) => {
  const cleanups = dependencies.map((dependency) => dependency.subscribe(callback))
  callback()
  return () => cleanups.forEach((cleanup) => cleanup())
}

/**********************************************************************************/
/*                                                                                */
/*                                    subscribe                                   */
/*                                                                                */
/**********************************************************************************/

/**
 * Subscribes to changes in a list of dependencies (either Atoms or Tokens) and calls a callback function with the
 * latest values of these dependencies whenever any of them changes. The callback also runs immediately upon creation.
 *
 * @template TDeps The types of the dependencies, which must extend an array of Atoms or Tokens.
 * @param {TDeps} dependencies An array of dependencies to subscribe to.
 * @param {(values: AtomArrayReturnValues<TDeps>) => void} callback A callback function to be called with the current
 *        values of the dependencies whenever any of the dependencies changes. The callback receives an array where
 *        each element corresponds to the current value of the dependency at the same index in the `dependencies` array.
 * @returns {() => void} A function that unsubscribes from all dependencies when called, cleaning up all internal
 *          subscriptions. This is useful for preventing memory leaks in applications with dynamic subscription lifetimes.
 * @example
 * // Assuming Atom is a class with a get() method that returns the current value
 * const countAtom = new Atom(0);
 * const doubledCount = new Atom(0);
 *
 * const unsubscribe = subscribe([countAtom], ([count]) => {
 *   doubledCount.set(count * 2);
 * });
 *
 * // Later, when you no longer need the subscription:
 * unsubscribe();
 */

export const subscribe = <const TDeps extends (Atom<any> | Token<any>)[]>(
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
  const cleanups = dependencies.map((dependency) =>
    dependency.subscribe(() => callback(getLatestDependencies()))
  )
  callback(getLatestDependencies())
  return () => cleanups.forEach((cleanup) => cleanup())
}

/**********************************************************************************/
/*                                                                                */
/*                                       memo                                     */
/*                                                                                */
/**********************************************************************************/

/**
 * Creates a memoized Atom that computes its value based on a set of dependencies. The memoized value is recalculated
 * only when the dependencies change. This function supports overloading with and without a default value for the
 * returned Atom.
 *
 * @template TDeps The types of the dependencies, which must extend an array of Atoms or Tokens.
 * @template TValue The type of the value that the memoized Atom will hold.
 * @param {TDeps} dependencies An array of dependencies that the memoized value depends on. The Atom's value will be
 *        recalculated whenever any of these dependencies change.
 * @param {(values: AtomArrayReturnValues<TDeps>, previous?: TValue) => TValue} callback A function that calculates the
 *        value of the Atom. This function receives the current values of the dependencies as its first argument and
 *        the Atom's previous value as its second argument (if available). It should return the new value of the Atom.
 * @param {TValue} [defaultValue] An optional default value for the Atom. This value is used as the Atom's initial value
 *        and as the `previous` value the first time the `callback` function is called.
 * @returns {Atom<TValue>} A new Atom instance that holds the memoized value. This Atom's value is updated whenever the
 *          `callback` function returns a new value, based on changes in the dependencies.
 *
 * Overloads:
 * - With defaultValue: Use when you want to explicitly set an initial value for the Atom.
 * - Without defaultValue: The Atom's initial value is the result of the first call to the callback function.
 *
 *  @example
 * // Assuming Atom is a class that allows for reactive state management.
 * const firstName = new Atom('John');
 * const lastName = new Atom('Doe');
 *
 * // Creates a memoized Atom that depends on firstName and lastName.
 * const fullName = memo([firstName, lastName], ([first, last]) => `${first} ${last}`);
 *
 * // The fullName Atom will automatically update whenever firstName or lastName changes.
 */

export function memo<TValue, const TDeps extends (Atom<any> | Token<any>)[]>(
  dependencies: TDeps,
  callback: (values: AtomArrayReturnValues<TDeps>, previous: TValue) => TValue,
  defaultValue: TValue
): Atom<TValue>
export function memo<TValue, const TDeps extends (Atom<any> | Token<any>)[]>(
  dependencies: TDeps,
  callback: (values: AtomArrayReturnValues<TDeps>, previous?: TValue) => TValue
): Atom<TValue>
export function memo<TValue, const TDeps extends (Atom<any> | Token<any>)[]>(
  dependencies: TDeps,
  callback: (values: AtomArrayReturnValues<TDeps>, previous?: TValue) => TValue,
  defaultValue?: TValue
) {
  const atom = new Atom<TValue>(defaultValue!)
  subscribe(dependencies, (dependencies) => atom.set((atom) => callback(dependencies, atom)))
  return atom
}
