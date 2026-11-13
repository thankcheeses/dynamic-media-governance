import { describe, expect, it } from 'vitest'
import { TOUR_STEPS } from '../components/tourSteps'
import { FINISH, STOPS, nextStop, stopIndex, tourProgress } from '../journey'

describe('the journey through the prototype', () => {
  it('every stop points to the one after it, and the last points to the proposal', () => {
    STOPS.slice(0, -1).forEach((stop, i) => {
      expect(nextStop(stop.to)).toMatchObject({ kind: 'stop', position: i + 1, total: STOPS.length, to: STOPS[i + 1].to, invite: STOPS[i + 1].invite })
    })
    expect(nextStop('/presentation')).toMatchObject({ kind: 'finish', href: FINISH.href, position: STOPS.length })
  })

  it('any profile is the banner stop; the owner profile and /me are the try-your-own stop', () => {
    expect(stopIndex('/u/mayamakes')).toBe(1)
    expect(nextStop('/u/mayamakes')).toMatchObject({ to: '/profile' })
    expect(stopIndex('/me')).toBe(stopIndex('/profile'))
    expect(nextStop('/me')).toMatchObject({ to: '/compose' })
  })

  it('pages off the path point back to the start', () => {
    expect(nextStop('/settings')).toMatchObject({ kind: 'rejoin', to: '/' })
    expect(nextStop('/privacy')).toMatchObject({ kind: 'rejoin', to: '/' })
  })

  it('the tour only sends people to stops on the journey, in journey order', () => {
    const order = TOUR_STEPS.map((step) => step.to).filter((to): to is string => Boolean(to)).map((to) => stopIndex(to))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('remembers where the tour was closed and ignores a bad saved step', () => {
    tourProgress.saveStep(3)
    expect(tourProgress.step(7)).toBe(3)
    expect(tourProgress.step(3)).toBe(0)
    tourProgress.saveStep(0)
    expect(tourProgress.step(7)).toBe(0)
    expect(tourProgress.pillHidden()).toBe(false)
    tourProgress.hidePill()
    expect(tourProgress.pillHidden()).toBe(true)
  })
})
