import { redirect } from "next/navigation";

export default function ProfileLayoutRedirect() {
  redirect("/dashboard/profile");
}
