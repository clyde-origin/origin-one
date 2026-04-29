// Streamed loading skeleton for any /projects/[projectId]/<sub> route.
// Renders inside the SubPageOverlay slide-up while the route's JS chunk
// loads (or the route is being compiled in dev). Once router.prefetch()
// has warmed the route — see HubContent useEffect — this is rarely seen
// for repeat navigations; it covers cold first hits and deep-linked URLs.

export default function Loading() {
  return (
    <div
      className="screen flex items-center justify-center"
      style={{ background: '#04040a', minHeight: '100vh' }}
    >
      <div
        className="rounded-full border animate-spin"
        style={{
          width: 22,
          height: 22,
          borderColor: 'rgba(255,255,255,0.1)',
          borderTopColor: 'rgba(255,255,255,0.55)',
        }}
        aria-label="Loading"
      />
    </div>
  )
}
