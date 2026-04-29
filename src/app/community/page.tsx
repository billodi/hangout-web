import { getCurrentUser } from "@/lib/auth";
import CommunityScreen from "./CommunityScreen";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const initialUser = await getCurrentUser();
  return <CommunityScreen initialUser={initialUser ? { id: initialUser.id } : null} />;
}

