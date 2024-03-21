import { Node3D, Scene } from '@tagl/world'

let shouldStop = false
const stop = () => {
  shouldStop = true
}

export const traverseParent = (
  root: Node3D | Scene,
  callback?: (object3D: Node3D | Scene, stop: () => void) => false | void
) => {
  let currentNode: Node3D | Scene | undefined = root
  shouldStop = false

  while (!shouldStop && currentNode && !(currentNode instanceof Scene)) {
    if (callback?.(currentNode, stop) === false) {
      return
    }
    currentNode = 'parent' in currentNode ? currentNode.parent : undefined
  }

  return currentNode
}
