import { describe, expect, it } from 'vitest'
import { insertEmoji, loadEmoji, searchEmoji } from '../emoji'

describe('emoji', () => {
  it('loads the whole Unicode set in its nine groups', async () => {
    const groups = await loadEmoji()
    expect(groups.map((group) => group.slug)).toEqual(['smileys_emotion', 'people_body', 'animals_nature', 'food_drink', 'travel_places', 'activities', 'objects', 'symbols', 'flags'])
    expect(groups.reduce((sum, group) => sum + group.emojis.length, 0)).toBeGreaterThan(1800)
  })

  it('finds emoji by every word typed', async () => {
    const groups = await loadEmoji()
    expect(searchEmoji(groups, 'clapping').map((entry) => entry.emoji)).toContain('👏')
    expect(searchEmoji(groups, 'face tears joy')[0].emoji).toBe('😂')
    expect(searchEmoji(groups, '   ')).toEqual([])
    expect(searchEmoji(groups, 'face', 5)).toHaveLength(5)
  })

  it('inserts at the cursor, replaces a selection and respects the limit', () => {
    expect(insertEmoji('hi there', '👏', 2, 2)).toEqual({ text: 'hi👏 there', cursor: 4 })
    expect(insertEmoji('hi there', '😂', 3, 8)).toEqual({ text: 'hi 😂', cursor: 5 })
    expect(insertEmoji('', '👏', 99, 99)).toEqual({ text: '👏', cursor: 2 })
    expect(insertEmoji('x'.repeat(279), '👏', 279, 279)).toBeNull()
  })
})
