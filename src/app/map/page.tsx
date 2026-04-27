import HangoutApp from "../HangoutApp";
import { getHomeData } from "@/lib/homeData";

export const dynamic = "force-dynamic";

export default async function MapPage(props: { searchParams: Promise<{ activity?: string }> }) {
  const { initialActivities, initialBackendOk, initialUser } = await getHomeData();
  const searchParams = await props.searchParams;
  return (
    <HangoutApp
      initialActivities={initialActivities}
      initialBackendOk={initialBackendOk}
      initialUser={initialUser}
      lockedView="map"
      preferredActivityId={typeof searchParams.activity === "string" ? searchParams.activity : null}
    />
  );
}
