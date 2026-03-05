// Silently handle Chrome DevTools probe requests to suppress server-side noise
export async function loader() {
  return new Response(null, { status: 200 });
}
