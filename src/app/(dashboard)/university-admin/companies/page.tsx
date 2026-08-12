import { redirect } from "next/navigation";

// University admins do not manage companies — that role belongs to
// super admins. Any deep link or stale bookmark to this route is
// sent back to the university admin dashboard.
export default function UniversityAdminCompaniesRedirect() {
  redirect("/university-admin");
}
