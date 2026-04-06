import type { Command } from '../../commands.js'

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Meet your companion',
  argumentHint: '[pet|mute|unmute]',
  load: () => import('./buddy.js'),
} satisfies Command

export default buddy
