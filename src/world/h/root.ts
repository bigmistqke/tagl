import { Scene } from '../primitives'

export class Root {
  constructor(config: { scene: Scene }) {
    return config.scene
  }
}
