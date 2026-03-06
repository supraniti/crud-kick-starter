export async function pingSystem() {
  const response = await fetch("/api/system/ping", {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Ping failed with status ${response.status}`);
  }

  return response.json();
}
