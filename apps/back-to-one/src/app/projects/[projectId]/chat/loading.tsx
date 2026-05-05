// Chat route — Suspense fallback. Mirrors the loaded Chat panel layout
// exactly (apps/back-to-one/src/app/projects/[projectId]/chat/page.tsx):
//   PageHeader (Chat title + project meta)
//   .chat-tabs (Team / Direct segmented tabs)
//   .chat-channel-pills (channel pill strip + + Topic affordance)
//   message list (alternating bubbles + day separator)
//   .chat-input-bar (pill-shaped input + send arrow)
//
// Re-uses the page's own chrome (.chat-tabs / .chat-channel-pills /
// .chat-input-bar) so the skeleton inherits the loaded layout's borders
// and spacing — only inner content swaps for .sk shimmer rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { ChatSkeleton } from '@/components/chat/ChatSkeleton'

export default function ChatLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Chat"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
          </div>
        }
      />
      <ChatSkeleton />
    </div>
  )
}
