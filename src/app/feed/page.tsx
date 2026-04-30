import { getCurrentUser } from "@/lib/auth";
import FeedScreen from "./FeedScreen";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await getCurrentUser();
  return <FeedScreen initialUser={user ? { id: user.id } : null} />;
}

