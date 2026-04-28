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

const tonePrimer = 'Project: Lumière Skincare. Soft window light, marble, amber glass.'

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
  it('contains tone primer, scene description, framing, action, and style suffix', () => {
    const prompt = buildStoryboardPrompt({
      shot: baseShot,
      scene: baseScene,
      tonePrimer,
    })
    expect(prompt).toContain(tonePrimer)
    expect(prompt).toContain(baseScene.description)
    expect(prompt).toContain('extreme close-up')
    expect(prompt).toContain(baseShot.description)
    expect(prompt).toContain('pencil storyboard sketch')
  })

  it('omits the framing line when shot.size is undefined', () => {
    const prompt = buildStoryboardPrompt({
      shot: { ...baseShot, size: undefined },
      scene: baseScene,
      tonePrimer,
    })
    expect(prompt).not.toContain('Shot framing:')
    expect(prompt).toContain(baseShot.description)
  })

  it('puts sections in the expected order', () => {
    const prompt = buildStoryboardPrompt({
      shot: baseShot,
      scene: baseScene,
      tonePrimer,
    })
    const primerIdx = prompt.indexOf(tonePrimer)
    const sceneIdx = prompt.indexOf('Scene context:')
    const framingIdx = prompt.indexOf('Shot framing:')
    const actionIdx = prompt.indexOf('Action:')
    const styleIdx = prompt.indexOf('Style:')
    expect(primerIdx).toBeLessThan(sceneIdx)
    expect(sceneIdx).toBeLessThan(framingIdx)
    expect(framingIdx).toBeLessThan(actionIdx)
    expect(actionIdx).toBeLessThan(styleIdx)
  })
})
