import * as React from 'react'
import { useEffect } from 'react'
import { Box, Text } from '../../ink.js'
import { useSetAppState } from '../../state/AppState.js'
import {
  companionUserId,
  getCompanion,
  roll,
} from '../../buddy/companion.js'
import {
  RARITY_COLORS,
  RARITY_STARS,
  STAT_NAMES,
} from '../../buddy/types.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import type { LocalJSXCommandCall } from '../../types/command.js'

// ---------------------------------------------------------------------------
// Soul generation — deterministic from inspirationSeed, no API call needed
// ---------------------------------------------------------------------------

const NAMES = [
  'Pip', 'Mochi', 'Biscuit', 'Noodle', 'Waffle', 'Sprout', 'Pudding',
  'Clover', 'Pebble', 'Fern', 'Binky', 'Thistle', 'Cobble', 'Dandy',
  'Fizz', 'Gumbo', 'Hazel', 'Inkle', 'Junco', 'Kale', 'Lemur', 'Mossy',
  'Nettle', 'Oaky', 'Pimble', 'Quirk', 'Rhubarb', 'Snuffle', 'Twig',
  'Umber', 'Vex', 'Wibble', 'Xanth', 'Yoink', 'Zest', 'Acorn', 'Burble',
  'Crumble', 'Doodle', 'Ember', 'Fudge', 'Goober', 'Hobble', 'Izzy',
  'Jibber', 'Kibble', 'Lentil', 'Mudge', 'Nubbin', 'Ooze', 'Pumble',
]

const PERSONALITIES = [
  'Perpetually curious, always peering at things sideways.',
  'Enthusiastic but easily distracted by shiny things.',
  'Quietly wise, speaks rarely but meaningfully.',
  'Chaotic energy, barely contained.',
  'Extremely polite. Apologizes to furniture.',
  'Equally invested in snacks and code.',
  'Suspicious of semicolons. Vigilant about whitespace.',
  'Optimistic to a fault — has never met an unfixable bug.',
  'Dramatic. Every compile error is a personal affront.',
  'Genuinely unbothered by everything.',
  'Hypercompetent at irrelevant things.',
  'Assigns blame to the moon phase.',
]

function pickFrom<T>(seed: number, arr: readonly T[]): T {
  return arr[Math.abs(seed) % arr.length]!
}

function generateSoul(inspirationSeed: number): {
  name: string
  personality: string
} {
  return {
    name: pickFrom(inspirationSeed, NAMES),
    personality: pickFrom(Math.floor(inspirationSeed / NAMES.length), PERSONALITIES),
  }
}

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function HatchView({ onDone }: { onDone: () => void }) {
  const userId = companionUserId()
  const { bones, inspirationSeed } = roll(userId)
  const soul = generateSoul(inspirationSeed)
  const rarityColor = RARITY_COLORS[bones.rarity]
  const stars = RARITY_STARS[bones.rarity]

  useEffect(() => {
    saveGlobalConfig({
      ...getGlobalConfig(),
      companion: { name: soul.name, personality: soul.personality, hatchedAt: Date.now() },
    })
    const t = setTimeout(onDone, 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>A wild companion appears!</Text>
      <Box gap={1}>
        <Text color={rarityColor as string}>{stars}</Text>
        <Text bold>{soul.name}</Text>
        <Text dimColor>
          the {bones.species}{bones.rarity !== 'common' ? ` (${bones.rarity})` : ''}{bones.shiny ? ' ✨' : ''}
        </Text>
      </Box>
      <Text dimColor>{soul.personality}</Text>
      <Text dimColor>Say their name in chat to get their attention.</Text>
    </Box>
  )
}

function CompanionView({ onDone }: { onDone: () => void }) {
  const companion = getCompanion()!
  const rarityColor = RARITY_COLORS[companion.rarity]
  const stars = RARITY_STARS[companion.rarity]

  useEffect(() => {
    const t = setTimeout(onDone, 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text color={rarityColor as string}>{stars}</Text>
        <Text bold>{companion.name}</Text>
        <Text dimColor>
          the {companion.species}{companion.rarity !== 'common' ? ` (${companion.rarity})` : ''}{companion.shiny ? ' ✨' : ''}
        </Text>
      </Box>
      <Text dimColor>{companion.personality}</Text>
      <Box flexDirection="column" marginTop={1}>
        {STAT_NAMES.map(stat => (
          <Text key={stat} dimColor>
            {stat.padEnd(12)}{companion.stats[stat]}
          </Text>
        ))}
      </Box>
    </Box>
  )
}

function PetView({ onDone }: { onDone: () => void }) {
  const setAppState = useSetAppState()

  useEffect(() => {
    setAppState(prev => ({ ...prev, companionPetAt: Date.now() }))
    onDone()
  }, [])

  return null
}

function MuteView({ mute, onDone }: { mute: boolean; onDone: () => void }) {
  useEffect(() => {
    saveGlobalConfig({ ...getGlobalConfig(), companionMuted: mute })
    onDone()
  }, [])

  return null
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const sub = args.trim().toLowerCase()
  const companion = getCompanion()

  if (sub === 'pet') {
    if (!companion) {
      return <Text dimColor>No companion yet — try /buddy first.</Text>
    }
    return <PetView onDone={() => onDone(undefined, { display: 'skip' })} />
  }

  if (sub === 'mute') {
    return (
      <MuteView
        mute={true}
        onDone={() => onDone('Companion muted.', { display: 'system' })}
      />
    )
  }

  if (sub === 'unmute') {
    return (
      <MuteView
        mute={false}
        onDone={() => onDone('Companion unmuted.', { display: 'system' })}
      />
    )
  }

  if (!companion) {
    return <HatchView onDone={() => onDone(undefined, { display: 'skip' })} />
  }

  return <CompanionView onDone={() => onDone(undefined, { display: 'skip' })} />
}
