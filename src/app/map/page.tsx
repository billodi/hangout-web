import { getHomeData } from "@/lib/homeData";
import MapScreen from "./MapScreen";

export const dynamic = "force-dynamic";

export default async function MapPage(props: { searchParams: Promise<{ activity?: string }> }) {
  const { initialActivities, initialBackendOk, initialUser } = await getHomeData();
  const searchParams = await props.searchParams;
  return (
    <MapScreen
      initialActivities={initialActivities}
      initialBackendOk={initialBackendOk}
      initialUser={initialUser}
      preferredActivityId={typeof searchParams.activity === "string" ? searchParams.activity : null}
    />
  );
}
