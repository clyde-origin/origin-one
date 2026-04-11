// This layout wraps every screen inside a project.
// It will eventually: check project access, load project data,
// provide project context to all child screens.

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { projectId: string }
}) {
  return (
    <div className="relative w-full h-full">
      {children}
    </div>
  )
}
