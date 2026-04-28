import { describe, it, expect } from 'vitest'
import {
  bucketForSurface,
  localFilePath,
  storagePath,
  imageSizeForSurface,
  type ImageEntry,
} from './paths'

const sample: ImageEntry = {
  projectKey: 'p1',
  surface: 'location',
  slug: 'bel-air-wide',
  source: 'stock',
  query: 'bel air estate marble bathroom morning',
  caption: 'Wide reference, mid-day',
  matchByName: 'Bel Air Estate',
}

describe('bucketForSurface', () => {
  it('routes location surfaces to entity-attachments', () => {
    expect(bucketForSurface('location')).toBe('entity-attachments')
    expect(bucketForSurface('narrativeLocation')).toBe('entity-attachments')
    expect(bucketForSurface('prop')).toBe('entity-attachments')
    expect(bucketForSurface('wardrobe')).toBe('entity-attachments')
    expect(bucketForSurface('hmu')).toBe('entity-attachments')
    expect(bucketForSurface('cast')).toBe('entity-attachments')
  })

  it('routes moodboard to moodboard bucket', () => {
    expect(bucketForSurface('moodboard')).toBe('moodboard')
  })

  it('routes avatar to avatars bucket', () => {
    expect(bucketForSurface('avatar')).toBe('avatars')
  })
})

describe('localFilePath', () => {
  it('formats as <projectKey>/<surface>/<slug>.jpg', () => {
    expect(localFilePath(sample)).toBe('p1/location/bel-air-wide.jpg')
  })

  it('uses crew/<surface>/... for projectKey crew', () => {
    expect(localFilePath({ ...sample, projectKey: 'crew', surface: 'avatar', slug: 'dani-reeves' }))
      .toBe('crew/avatar/dani-reeves.jpg')
  })
})

describe('storagePath', () => {
  it('formats EntityAttachment surfaces as <attachedToType>/<rowId>/<slug>.jpg', () => {
    expect(storagePath({ ...sample, surface: 'location' }, 'row-uuid-123'))
      .toBe('location/row-uuid-123/bel-air-wide.jpg')
  })

  it('formats moodboard as <projectId>/<slug>.jpg', () => {
    expect(storagePath({ ...sample, surface: 'moodboard', slug: 'morning-ritual' }, 'project-uuid'))
      .toBe('project-uuid/morning-ritual.jpg')
  })

  it('formats avatar as <userId>/<slug>.jpg', () => {
    expect(storagePath({ ...sample, surface: 'avatar', slug: 'dani-reeves' }, 'user-uuid'))
      .toBe('user-uuid/dani-reeves.jpg')
  })
})

describe('imageSizeForSurface', () => {
  it('uses landscape for location/moodboard/prop/wardrobe/hmu', () => {
    for (const s of ['location', 'narrativeLocation', 'moodboard', 'prop', 'wardrobe', 'hmu'] as const) {
      expect(imageSizeForSurface(s)).toBe('1536x1024')
    }
  })

  it('uses square for cast/avatar', () => {
    expect(imageSizeForSurface('cast')).toBe('1024x1024')
    expect(imageSizeForSurface('avatar')).toBe('1024x1024')
  })
})

describe('bucketForSurface — storyboard', () => {
  it('routes storyboard to storyboard bucket', () => {
    expect(bucketForSurface('storyboard')).toBe('storyboard')
  })
})
