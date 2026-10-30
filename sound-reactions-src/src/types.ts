export type MediaKind = 'reaction' | 'voice'
export type Decision = 'PASS' | 'REVIEW' | 'BLOCK'
export type FailurePolicy = 'REVIEW' | 'BLOCK'
export type SubmissionStatus = 'PUBLISHED' | 'HOLD' | 'BLOCKED' | 'REPORTED' | 'REMOVED' | 'ESCALATED'

export interface Clip {
  id: string
  name: string
  kind: MediaKind
  duration: number
  description: string
  transcript: string
  emoji: string
  sizeKb: number
  lufs: number
  aiDeclared: boolean
  aiLabel: boolean
  abuse: boolean
  copyright: boolean
  audioUrl?: string
  simulated?: boolean
  /** Library sound this clip came from; survives id rewrites when copied onto posts. */
  soundId?: string
  category?: SoundCategory
}

export type SoundCategory = 'Hype' | 'Reactions' | 'Comedy' | 'Sad' | 'Game show'

export interface Reaction extends Clip {
  count: number
  removed?: boolean
}

export interface QuotedPost {
  author: string
  handle: string
  initials: string
  timestamp: string
  body: string
  verified?: boolean
}

export interface Post {
  id: string
  author: string
  handle: string
  initials: string
  timestamp: string
  body: string
  verified?: boolean
  quote?: QuotedPost
  topics?: string[]
  voice?: Clip
  reaction?: Reaction
  replyCount: number
  repostCount: number
  likeCount: number
  viewCount: number
  following: boolean
}

export interface AppSettings {
  muted: boolean
  volume: number
  captions: boolean
  reducedMotion: boolean
  dataSaver: boolean
  lowPower: boolean
  theme: 'lights-out' | 'dim'
}

export type CheckKey = 'duration' | 'size' | 'transcript' | 'loudness' | 'rate' | 'abuse' | 'copyright' | 'synthetic'

export interface GovernanceConfig {
  durationLimit: number
  voiceDurationLimit: number
  sizeLimit: number
  loudnessMin: number
  loudnessMax: number
  rateLimit: number
  policies: Record<CheckKey, FailurePolicy>
}

export interface PreflightCheck {
  key: CheckKey
  label: string
  passed: boolean
  policy: FailurePolicy
  simulated: boolean
  detail: string
}

export interface PreflightResult {
  decision: Decision
  outcome: SubmissionStatus
  reasonCodes: string[]
  checks: PreflightCheck[]
}

export interface AuditEvent {
  id: string
  timestamp: string
  type: string
  actor: string
  subjectId: string
  detail: string
}

export interface Submission {
  id: string
  submittedAt: string
  clip: Clip
  postText: string
  postId?: string
  decision: Decision
  status: SubmissionStatus
  reasonCodes: string[]
  checks: PreflightCheck[]
  statementOfReasons?: string
  reportReason?: string
}
