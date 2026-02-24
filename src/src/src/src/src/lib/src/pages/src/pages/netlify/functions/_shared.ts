export function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    body: JSON.stringify(body)
  };
}
export function bad(statusCode: number, message: string) {
  return json(statusCode, { error: message });
}
