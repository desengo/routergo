import { supabase } from "./supabase";

type Driver = {
  id: string;
  name: string;
  driver_status: string;
  queue_position: number;
};

type Route = {
  id: string;
  user_id: string;
  name: string;
  status: string;
  assigned_driver_id: string | null;
};

async function getAvailableDrivers(): Promise<Driver[]> {

  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,driver_status,queue_position")
    .eq("driver_status", "available")
    .order("queue_position", { ascending: true })
    .limit(7);

  if (error) throw error;

  return data || [];
}

async function getNewRoutes(): Promise<Route[]> {

  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .eq("status", "new")
    .is("assigned_driver_id", null)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data || [];
}

async function assignRoute(route: Route, driver: Driver) {

  const { error } = await supabase
    .from("routes")
    .update({
      assigned_driver_id: driver.id
    })
    .eq("id", route.id);

  if (error) throw error;
}

async function moveDriverToEnd(driverId: string) {

  const { data } = await supabase
    .from("profiles")
    .select("queue_position")
    .order("queue_position", { ascending: false })
    .limit(1);

  const lastPosition = data?.[0]?.queue_position || 0;

  await supabase
    .from("profiles")
    .update({
      queue_position: lastPosition + 1
    })
    .eq("id", driverId);
}

export async function runDispatchEngine() {

  try {

    const drivers = await getAvailableDrivers();
    const routes = await getNewRoutes();

    if (!drivers.length) return;
    if (!routes.length) return;

    for (let i = 0; i < routes.length; i++) {

      const driver = drivers[i % drivers.length];
      const route = routes[i];

      await assignRoute(route, driver);

    }

  } catch (err) {

    console.error("Dispatch error", err);

  }
}