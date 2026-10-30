/**
 * "Make it yours": a visitor can relabel the owner account with their own name,
 * handle, bio and photo so the demo reads as their profile. It lives only in
 * this browser, under its own storage key so a demo reset keeps it, and the
 * photo is shrunk to a small square before it is stored. Nothing is uploaded.
 */
import { create } from 'zustand'
import { ACCOUNTS, OWNER_HANDLE } from './accounts'

export interface Identity {
  name: string
  handle: string
  bio: string
  /** A small square JPEG data URL, or none to keep the initials. */
  photo?: string
}

const STORAGE_KEY = 'sound-reactions-identity'
export const NAME_MAX = 50
export const HANDLE_MAX = 15
export const BIO_MAX = 160

function load(): Identity | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Identity>
    return typeof parsed.name === 'string' && typeof parsed.handle === 'string' ? { name: parsed.name, handle: parsed.handle, bio: parsed.bio ?? '', photo: parsed.photo } : null
  } catch { return null }
}

export const useIdentity = create<{ identity: Identity | null; setIdentity: (identity: Identity | null) => void }>((set) => ({
  identity: load(),
  setIdentity: (identity) => {
    try {
      if (identity) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch { /* storage may be unavailable; the identity then lasts for this page only */ }
    set({ identity })
  },
}))

/** Up to two initials from a name, for the avatar tint and fallback. */
export function initialsOf(name: string): string {
  const letters = name.trim().split(/\s+/).map((part) => part[0]).filter(Boolean)
  return (letters.length ? letters.slice(0, 2).join('') : 'ME').toUpperCase()
}

/** X-style handle: letters, digits and underscores, one leading @, at most 15 characters. */
export function normalizeHandle(raw: string): string {
  const body = raw.replace(/[^A-Za-z0-9_]/g, '').slice(0, HANDLE_MAX)
  return body ? `@${body}` : ''
}

/** How the owner account should be shown: the visitor's identity if set, otherwise the demo owner. */
export function ownerLook(identity: Identity | null) {
  const owner = ACCOUNTS.find((account) => account.handle === OWNER_HANDLE)!
  if (!identity) return { name: owner.name, handle: owner.handle, bio: owner.bio, initials: owner.initials, photo: undefined as string | undefined, custom: false }
  return { name: identity.name, handle: identity.handle, bio: identity.bio, initials: initialsOf(identity.name), photo: identity.photo, custom: true }
}

/** Shrinks a chosen photo to a small centred square JPEG so it stays light in storage. */
export async function squarePhoto(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot resize the photo')
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}
