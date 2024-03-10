import { Object3D } from '.'

export const traverse = (root: Object3D, callback: (object3D: Object3D) => void) => {
  const stack: Object3D[] = [root]

  while (stack.length > 0) {
    let currentNode = stack.pop() // Removes and returns the last element of the stack

    if (currentNode) {
      callback(currentNode)
    }

    if (currentNode && currentNode.__.children) {
      for (let child of currentNode.__.children) {
        stack.push(child)
      }
    }
  }
}
