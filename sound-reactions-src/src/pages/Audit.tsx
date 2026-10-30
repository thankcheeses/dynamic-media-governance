import { useMemo, useState } from 'react'
import { Download, FileClock, Search } from 'lucide-react'
import { EVENT_TYPES } from '../data'
import { useAppStore } from '../store'

export default function Audit() {
  const audits = useAppStore((state) => state.audits)
  const [type, setType] = useState('all')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => audits.filter((event) => (type === 'all' || event.type === type) && `${event.detail} ${event.subjectId}`.toLowerCase().includes(query.toLowerCase())).reverse(), [audits, type, query])
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'sound-reactions-audit.json'; anchor.click(); URL.revokeObjectURL(url)
  }
  return <div className="page-wrap"><header className="page-header"><span className="eyebrow">APPEND-ONLY EVENT TRAIL</span><h1>Audit log</h1><p>Timestamped local events. The interface offers filtering and export, never editing or deletion.</p></header>
    <div className="audit-toolbar"><div className="search-field"><Search size={18} /><input aria-label="Search audit events" placeholder="Search IDs or details" value={query} onChange={(event) => setQuery(event.target.value)} /></div><select aria-label="Filter audit event type" value={type} onChange={(event) => setType(event.target.value)}><option value="all">All event types</option>{EVENT_TYPES.map((eventType) => <option key={eventType}>{eventType}</option>)}</select><button className="secondary-button" onClick={exportJson} disabled={!filtered.length}><Download size={17} /> Export JSON</button></div>
    <div className="audit-summary"><FileClock size={18} /><span>{filtered.length} of {audits.length} events</span><span>Newest first</span></div>
    {filtered.length === 0 ? <div className="empty-state"><FileClock size={30} /><h2>No matching events</h2><p>Publish, report, moderate or change the filters to see activity.</p></div> : <ol className="audit-list">{filtered.map((event) => <li key={event.id}><span className="audit-line" aria-hidden="true" /><div className="audit-time"><time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString()}</time><small>{event.actor}</small></div><div className="audit-event"><span>{event.type}</span><strong>{event.detail}</strong><small>{event.subjectId}</small></div></li>)}</ol>}
  </div>
}
