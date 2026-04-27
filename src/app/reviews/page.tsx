import { getCurrentUser } from "@/lib/auth";
import ReviewsApp from "./ReviewsApp";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const initialUser = await getCurrentUser();
  return <ReviewsApp initialUser={initialUser} />;
}

