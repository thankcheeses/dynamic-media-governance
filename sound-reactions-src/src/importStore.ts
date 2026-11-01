/**
 * The viewer's imported X archive, kept in memory only. Nothing in this store
 * is persisted: a reload or a closed tab clears it, and "Clear my import"
 * clears it on demand. Imported posts are placed in the main store's feed
 * flagged `ephemeral`, which the main store's persistence skips.
 */
import { create } from 'zustand'
import type { ArchiveImport, ImportedAccount, ImportedLike } from './archive'
import { useAppStore } from './store'

interface ImportState {
  account: ImportedAccount | null
  likes: ImportedLike[]
  stats: ArchiveImport['stats'] | null
  notes: string[]
  /** Post ids pinned to the Highlights tab, for the imported profile and the owner demo alike. */
  highlights: string[]
  objectUrls: string[]
  apply: (result: ArchiveImport) => void
  clear: () => void
  toggleHighlight: (postId: string) => void
}

export const useImport = create<ImportState>()((set, get) => ({
  account: null,
  likes: [],
  stats: null,
  notes: [],
  highlights: [],
  objectUrls: [],
  apply: (result) => {
    get().clear()
    useAppStore.getState().addPosts(result.posts)
    set({ account: result.account, likes: result.likes, stats: result.stats, notes: result.notes, objectUrls: result.objectUrls, highlights: [] })
  },
  clear: () => {
    const { objectUrls, account } = get()
    if (!account) return
    useAppStore.getState().removeEphemeral()
    for (const url of objectUrls) { try { URL.revokeObjectURL(url) } catch { /* already gone */ } }
    set({ account: null, likes: [], stats: null, notes: [], objectUrls: [], highlights: [] })
  },
  toggleHighlight: (postId) => set((state) => ({ highlights: state.highlights.includes(postId) ? state.highlights.filter((id) => id !== postId) : [postId, ...state.highlights] })),
}))

/** True when this handle is the viewer's imported account. */
export function isImportedHandle(handle: string | undefined, account: ImportedAccount | null): boolean {
  return !!account && !!handle && handle.toLowerCase() === account.handle.toLowerCase()
}
