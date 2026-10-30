import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { riseIn } from '../motion'

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  // Latest onClose without re-running the mount effect: parents pass inline
  // closures, and re-running would replay the entrance and steal focus.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    riseIn(panelRef.current, 18)
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', handler)
    return () => { document.removeEventListener('keydown', handler); previous?.focus() }
  }, [])
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={panelRef} className={`modal-panel ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header"><button ref={closeRef} className="x-close" onClick={onClose} aria-label="Close dialog"><X size={20} /></button><h2 id="modal-title">{title}</h2></header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}
