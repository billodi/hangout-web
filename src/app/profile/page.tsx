import { getCurrentUser } from "@/lib/auth";
import ProfileEditorApp from "./ProfileEditorApp";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const initialUser = await getCurrentUser();
  return <ProfileEditorApp initialUser={initialUser} />;
}

