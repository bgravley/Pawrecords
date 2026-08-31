// Match PostgREST's successful `returns void` RPC shape in the Stripe behavior harness.
// The production Supabase RPC is invoked without `Prefer: return=minimal`, so a successful
// void function is represented as JSON null. The test helper's generic null response
// otherwise creates an actually empty body, which makes Response.json() throw.
const NativeResponse = globalThis.Response;

if (NativeResponse) {
  globalThis.Response = class PostgrestCompatibleResponse extends NativeResponse {
    constructor(body = null, init = {}) {
      const status = Number(init?.status ?? 200);
      const headers = new Headers(init?.headers || {});

      // Only normalize the 200/empty-body shape used by the void RPC. Leave 201
      // return=minimal responses (for commission inserts) genuinely empty.
      if (body === null && status === 200 && !headers.has('content-type')) {
        headers.set('content-type', 'application/json');
        super('null', { ...init, headers });
        return;
      }

      super(body, init);
    }
  };
}
