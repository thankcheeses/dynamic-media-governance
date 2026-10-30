import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Compare from '../pages/Compare'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() }, Toaster: () => null }))

describe('audio format accessibility', () => {
  it('gives voice posts and reactions different accessible names', () => {
    render(<MemoryRouter><Compare /></MemoryRouter>)
    expect(screen.getAllByRole('button', { name: 'Play voice post by @mayamakes' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Play Applause sound reaction, 3 s' }).length).toBeGreaterThan(0)
  })
  it('renders text alternatives without requiring playback', () => {
    render(<MemoryRouter><Compare /></MemoryRouter>)
    expect(screen.getAllByText(/warm burst of hand claps/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Fictional voice post/).length).toBeGreaterThan(0)
  })
})
