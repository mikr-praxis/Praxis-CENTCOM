import { redirect } from 'next/navigation'

// /reporting/[slug] was merged into /clients. Redirect any old links to the
// unified workspace. /reporting/[slug]/configure (KPI editor) and the public
// /reporting/share/[token] route still exist.
export default async function ReportingClientRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await params
  redirect('/clients')
}
