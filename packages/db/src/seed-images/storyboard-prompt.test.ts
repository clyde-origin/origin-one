import { describe, it, expect } from 'vitest'
import { buildStoryboardPrompt, humanizeShotSize } from './storyboard-prompt'
import type { ShotSize } from '../seed-data/shots'

const baseShot = {
  shotNumber: '01A',
  size: 'extreme_close_up' as ShotSize,
  status: 'planned' as const,
  sortOrder: 1,
  description: 'Fingers drawing a single drop from the bottle.',
}

const baseScene = {
  sceneNumber: '01',
  title: 'The Ritual',
  sortOrder: 1,
  description: 'Bathroom. Marble surfaces, soft window light.',
}

describe('humanizeShotSize', () => {
  it('maps each enum value to a natural-language phrase', () => {
    expect(humanizeShotSize('extreme_close_up')).toBe('extreme close-up')
    expect(humanizeShotSize('close_up')).toBe('close-up')
    expect(humanizeShotSize('medium_close_up')).toBe('medium close-up')
    expect(humanizeShotSize('medium')).toBe('medium shot')
    expect(humanizeShotSize('wide')).toBe('wide shot')
    expect(humanizeShotSize('full')).toBe('full shot')
    expect(humanizeShotSize('insert')).toBe('insert shot')
  })

  it('returns null for undefined size', () => {
    expect(humanizeShotSize(undefined)).toBeNull()
  })
})

describe('buildStoryboardPrompt', () => {
  it('leads with the pencil-sketch style directive', () => {
    const prompt = buildStoryboardPrompt({ shot: baseShot, scene: baseScene })
    expect(prompt.startsWith('A black-and-white pencil storyboard sketch')).toBe(true)
  })

  it('contains scene description, framing, action, and style tail', () => {
    const prompt = buildStoryboardPrompt({ shot: baseShot, scene: baseScene })
    expect(prompt).toContain(baseScene.description)
    expect(prompt).toContain('extreme close-up')
    expect(prompt).toContain(baseShot.description)
    expect(prompt).toContain('Render as a pencil and ink storyboard sketch')
  })

  it('explicitly negates photography and color', () => {
    const prompt = buildStoryboardPrompt({ shot: baseShot, scene: baseScene })
    expect(prompt).toMatch(/Not a photograph/i)
    expect(prompt).toMatch(/No color/i)
  })

  it('does not include the project tone primer', () => {
    // Recipe v2 drops the tone primer because its photography/color terms
    // overrode the sketch style on ~half of P1 frames in the visual gate.
    const prompt = buildStoryboardPrompt({ shot: baseShot, scene: baseScene })
    expect(prompt).not.toContain('Lumière')
    expect(prompt).not.toContain('Editorial beauty')
  })

  it('omits the framing line when shot.size is undefined', () => {
    const prompt = buildStoryboardPrompt({ shot: { ...baseShot, size: undefined }, scene: baseScene })
    expect(prompt).not.toContain('Framing:')
    expect(prompt).toContain(baseShot.description)
  })

  it('puts sections in the expected order: STYLE_LEAD → Scene → Framing → Action → STYLE_TAIL', () => {
    const prompt = buildStoryboardPrompt({ shot: baseShot, scene: baseScene })
    const leadIdx    = prompt.indexOf('A black-and-white pencil storyboard sketch')
    const sceneIdx   = prompt.indexOf('Scene:')
    const framingIdx = prompt.indexOf('Framing:')
    const actionIdx  = prompt.indexOf('Action:')
    const tailIdx    = prompt.indexOf('Render as a pencil')
    expect(leadIdx).toBe(0)
    expect(leadIdx).toBeLessThan(sceneIdx)
    expect(sceneIdx).toBeLessThan(framingIdx)
    expect(framingIdx).toBeLessThan(actionIdx)
    expect(actionIdx).toBeLessThan(tailIdx)
  })
})
