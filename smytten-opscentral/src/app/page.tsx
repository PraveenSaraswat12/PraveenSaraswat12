import { redirect } from "next/navigation";
import { auth } from "@/lib/session";
import { defaultPathForRole } from "@/lib/rbac";

// Root is a router: send each authenticated user to their role's home.
// (Middleware also handles this; this is a safety net.)
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(defaultPathForRole(session.user.role));
}
