/**
 * The viewer's imported X archive, kept in memory only. Nothing in this store
 * is persisted: a reload or a closed tab clears it, and "Clear my import"
 * clears it on demand. Imported posts are placed in the main store's feed
 * flagged `ephemeral`, which the main store's persistence skips; Highlights
 * pins live in the main store too, and the pins on imported posts go when the
 * import does.
 */
import { create } from 'zustand'
import type { ArchiveImport, ImportedAccount, ImportedLike } from './archive'
import { useAppStore } from './store'

export { isImportedHandle } from './profileView'

interface ImportState {
  account: ImportedAccount | null
  likes: ImportedLike[]
  stats: ArchiveImport['stats'] | null
  notes: string[]
  objectUrls: string[]
  apply: (result: ArchiveImport) => void
  clear: () => void
}

export const useImport = create<ImportState>()((set, get) => ({
  account: null,
  likes: [],
  stats: null,
  notes: [],
  objectUrls: [],
  apply: (result) => {
    get().clear()
    useAppStore.getState().addPosts(result.posts)
    set({ account: result.account, likes: result.likes, stats: result.stats, notes: result.notes, objectUrls: result.objectUrls })
  },
  clear: () => {
    const { objectUrls, account } = get()
    if (!account) return
    useAppStore.getState().removeEphemeral()
    for (const url of objectUrls) { try { URL.revokeObjectURL(url) } catch { /* already gone */ } }
    set({ account: null, likes: [], stats: null, notes: [], objectUrls: [] })
  },
}))
