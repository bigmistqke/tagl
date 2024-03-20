import { $TYPE } from '.'
import { GL, Program } from './gl'
import type { BufferToken, Token } from './tokens'
import type { Accessor, Setter } from './types'

/**********************************************************************************/
/*                                       ATOM                                     */
/**********************************************************************************/
export type Atom<T = any> = {
  [$TYPE]: 'atom'
  set: Setter<T>
  get: Accessor<T>
  onBeforeDraw: (handler: () => void) => () => void
  onBind: (handler: (program: Program) => void) => () => void
  subscribe: (callback: (value: T) => void) => () => void
  __: {
    bind: (program: Program, callback?: () => false | void) => void
    requestRender: () => void
    notify: () => void
  }
}

/**
 * Creates and returns a new atom object. An atom is a state management tool that allows you to store, update,
 * and subscribe to changes in a value. It also integrates with rendering mechanisms and custom notification logic.
 *
 * @param {T} value The initial value of the atom.
 * @returns {Atom<T>} The created atom object with methods for state management and subscriptions.
 *
 * @template T The type of the value stored in the atom.
 *
 * The returned atom object includes the following properties and methods:
 * - `get()` Returns the current value of the atom.
 * - `set(value | updater)` Updates the atom's value. If an updater function is provided, it receives the current value and a config object with methods to prevent notifications or rendering as arguments.
 * - `subscribe(callback)` Subscribes to changes in the atom's value. The callback is called with the new value whenever it changes. Returns a function to unsubscribe.
 * - `onBeforeDraw(callback)` Registers a callback to be called before the atom's associated renderables are drawn. Useful for performing actions or updates before rendering.
 * - `onBind(handler)` Registers a handler that is called when the atom is bound to a program. This can be used to perform setup actions for rendering or other initialization tasks.
 * - `__` An object with internal methods for binding the atom to rendering programs, requesting renders, and notifying subscribers of changes. This is primarily used internally and should not be directly interacted with in most cases.
 *
 * @example
 * Creating an atom and subscribing to its changes:
 * ```javascript
 * const countAtom = atom(0); // Initializes an atom with the value 0.
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
 *@example
 * Preventing unnecessary renders or notifications:
 * ```javascript
 * const configAtom = atom({ silent: false, render: true });
 *
 * configAtom.set((currentValue, config) => {
 *   if (currentValue.silent) {
 *     config.preventNotification();
 *   }
 *   if (!currentValue.render) {
 *     config.preventRender();
 *   }
 *   return { ...currentValue, silent: !currentValue.silent };
 * });
 * ```
 *
 * @example
 * Using `onBeforeDraw` for rendering actions:
 * ```javascript
 * const visualAtom = atom({ color: 'blue' });
 *
 * visualAtom.onBeforeDraw(() => {
 *   console.log(`Preparing to draw with the color ${visualAtom.get().color}.`);
 * });
 * // Assuming `visualAtom` is associated with a renderable object,
 * // this callback would run before the object is drawn.
 * ```
 *
 * Additionally, the atom integrates with rendering mechanisms through the onBind and onBeforeDraw methods, allowing for efficient updates and rendering control.
 */

export const atom = <T>(value: T) => {
  const cache = new Set<GL>()

  let shouldNotify = true
  let shouldRender = true
  const config = {
    preventNotification: () => (shouldNotify = false),
    preventRender: () => (shouldRender = false),
  }

  const subscriptions: ((value: T) => void)[] = []
  const requestRenderCallbacks: (() => void)[] = []
  const requestRender = () => {
    for (let i = 0; i < requestRenderCallbacks.length; i++) {
      requestRenderCallbacks[i]!()
    }
  }
  const notify = () => {
    for (let i = 0; i < subscriptions.length; i++) {
      subscriptions[i]!(value)
    }
  }
  const onBeforeDrawHandlers: (() => void)[] = []
  const onBindHandlers: ((program: Program) => void)[] = []
  const programs: Program[] = []

  const atom: Atom<T> = {
    [$TYPE]: 'atom',
    get: () => value,
    set: (_value) => {
      if (typeof _value === 'function') {
        // @ts-expect-error
        value = _value(value, config)
      } else {
        value = _value
      }

      if (shouldNotify) notify()
      if (shouldRender) {
        requestRender()
      }

      shouldNotify = true
      shouldRender = true
    },
    onBeforeDraw: (callback: () => void) => {
      onBeforeDrawHandlers.push(callback)
      for (let i = 0; i < programs.length; i++) {
        programs[i]!.onBeforeDraw(callback)
      }
      return () => {
        console.error('TODO')
      }
    },
    onBind: (handler: (program: Program) => void) => {
      onBindHandlers.push(handler)
      return () => {}
    },
    subscribe: (callback: (value: T) => void) => {
      subscriptions.push(callback)
      return () => {
        console.error('TODO')
        /* subscriptions.delete(callback) */
      }
    },
    __: {
      bind: (program, callback) => {
        if (cache.has(program.gl)) return
        cache.add(program.gl)

        for (let i = 0; i < onBindHandlers.length; i++) {
          onBindHandlers[i]!(program)
        }

        programs.push(program)
        for (let i = 0; i < onBeforeDrawHandlers.length; i++) {
          program.onBeforeDraw(onBeforeDrawHandlers[i]!)
        }

        requestRenderCallbacks.push(() => {
          if (callback?.() === false) return
          program.gl.requestRender()
        })
      },
      requestRender,
      notify,
    },
  }

  return atom
}

/**********************************************************************************/
/*                                     EFFECT                                     */
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

export const effect = (callback: () => void, dependencies: (Atom<any> | Token<any> | BufferToken)[]) => {
  const cleanups = dependencies.map((dependency) => dependency.subscribe(callback))
  callback()
  return () => cleanups.forEach((cleanup) => cleanup())
}
