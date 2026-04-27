import HangoutApp from "../HangoutApp";
import { getHomeData } from "@/lib/homeData";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const { initialActivities, initialBackendOk, initialUser } = await getHomeData();
  return (
    <HangoutApp
      initialActivities={initialActivities}
      initialBackendOk={initialBackendOk}
      initialUser={initialUser}
      lockedView="profiles"
    />
  );
}

