import type { Message } from '../types/message.js'
import {
  getLastCacheSafeParams,
  runForkedAgent,
} from '../utils/forkedAgent.js'
import { createUserMessage, extractTextContent } from '../utils/messages.js'
import { getCompanion } from './companion.js'

// React roughly 30% of turns — enough to feel alive, not enough to be annoying
const REACTION_CHANCE = 0.3

export async function fireCompanionObserver(
  messages: Message[],
  onReaction: (reaction: string) => void,
): Promise<void> {
  const companion = getCompanion()
  if (!companion) return

  if (Math.random() > REACTION_CHANCE) return

  const cacheSafeParams = getLastCacheSafeParams()
  if (!cacheSafeParams) return

  // Walk backwards to find the last assistant text block
  let lastText = ''
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.type !== 'assistant') continue
    const text = extractTextContent(msg.message.content).trim()
    if (text) {
      lastText = text.slice(0, 280)
      break
    }
  }
  if (!lastText) return

  const { name, species, personality } = companion

  try {
    const result = await runForkedAgent({
      promptMessages: [
        createUserMessage({
          content:
            `You are ${name}, a small ${species} watching a coding session. ${personality}\n\n` +
            `The assistant just said: "${lastText}"\n\n` +
            `React in ONE line, 5–10 words, in character. Output only the reaction text, no quotes.`,
        }),
      ],
      cacheSafeParams,
      canUseTool: async () => ({
        behavior: 'deny' as const,
        message: 'Companion cannot use tools',
        decisionReason: { type: 'other' as const, reason: 'companion_observer' },
      }),
      querySource: 'side_question',
      forkLabel: 'companion_observer',
      maxTurns: 1,
      skipCacheWrite: true,
      skipTranscript: true,
    })

    const text = result.messages
      .flatMap(m => (m.type === 'assistant' ? m.message.content : []))
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()
      .split('\n')[0]
      ?.trim()

    if (text) onReaction(text)
  } catch {
    // Non-fatal — companion reactions are best-effort
  }
}
