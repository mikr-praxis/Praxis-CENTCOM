import { redirect } from 'next/navigation'

// /reporting was merged into /clients. Keep this route alive as a redirect so
// any old bookmarks land in the right place.
export default function ReportingIndexRedirect() {
  redirect('/clients')
}
