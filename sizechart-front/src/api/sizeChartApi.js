const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function handleResponse(res) {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;
  if (!res.ok) {
    const err = new Error(body?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.errors = body?.errors;
    throw err;
  }
  return body;
}

export async function getSizeChart(productId) {
  const res = await fetch(`${API_BASE}/api/products/${productId}/size-chart`);
  if (res.status === 404) return null; // no chart saved yet — start fresh
  return handleResponse(res);
}

export async function saveSizeChart(productId, payload) {
  const res = await fetch(`${API_BASE}/api/products/${productId}/size-chart`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function uploadSizeChartImage(productId, file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${API_BASE}/api/products/${productId}/size-chart/image`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}

export async function deleteSizeChartImage(productId) {
  const res = await fetch(`${API_BASE}/api/products/${productId}/size-chart/image`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function getSizeChartPresets() {
  const res = await fetch(`${API_BASE}/api/size-chart-presets`);
  return handleResponse(res);
}

export function resolveImageUrl(url) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}
