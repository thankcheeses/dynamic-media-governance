import { useRef, useState } from 'react'
import { AudioLines } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { avatarContent, avatarStyle } from '../avatar'
import { POST_LIMIT } from '../emoji'
import { ownerLook, useIdentity } from '../identity'
import { useAppStore } from '../store'
import { EmojiPicker } from './EmojiPicker'

/** The post box at the top of the timeline: write a text post, add emoji, or carry the draft over to the sound composer. */
export function PostBox() {
  const postText = useAppStore((state) => state.postText)
  const me = ownerLook(useIdentity((state) => state.identity))
  const [text, setText] = useState('')
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const ready = text.trim().length > 0

  const post = () => {
    if (!ready) return
    postText(text)
    setText('')
    toast.success('Posted to the feed on this device')
  }

  return <form className="x-composer-row" aria-label="Write a post" onSubmit={(event) => { event.preventDefault(); post() }}>
    <span className="avatar" aria-hidden="true" style={avatarStyle(me.initials)}>{avatarContent(me.initials, me.photo)}</span>
    <div className="x-composer-body">
      <textarea ref={fieldRef} className="x-composer-input" aria-label="Post text" placeholder="What’s happening?" rows={1} maxLength={POST_LIMIT} value={text} onChange={(event) => setText(event.target.value)} />
      <div className="x-composer-tools">
        <Link to="/compose" state={{ text }} className="x-composer-tool" aria-label="Add a sound or voice note"><AudioLines size={19} aria-hidden="true" /></Link>
        <EmojiPicker target={fieldRef} value={text} onChange={setText} />
        {text.length > POST_LIMIT - 40 && <span className="x-composer-count" aria-live="polite">{POST_LIMIT - text.length}</span>}
        <button type="submit" className="x-composer-post" disabled={!ready}>Post</button>
      </div>
    </div>
  </form>
}
