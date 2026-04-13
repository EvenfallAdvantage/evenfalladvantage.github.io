/**
 * Reusable Supabase mock factory for unit tests.
 *
 * Returns a mock client that mirrors the Supabase JS client surface:
 *   - Chainable query builder (from → select → eq → order → limit → single / maybeSingle)
 *   - Auth (getUser)
 *   - Storage (from → createSignedUrl / getPublicUrl / upload)
 *   - RPC
 *
 * Usage:
 *   const { client, setMockResponse, setAuthUser, queryBuilder } = createMockSupabase();
 *   setMockResponse({ data: [{ id: 1 }], error: null });
 *   const { data } = await client.from("table").select("*").eq("id", 1);
 */
import { vi } from "vitest";

export interface MockResponse<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

export interface MockSupabase {
  /** The mock client — pass this wherever a SupabaseClient is expected */
  client: ReturnType<typeof buildClient>;
  /** Set the data/error that the next terminal query method will resolve */
  setMockResponse: (res: MockResponse) => void;
  /** Set the user object returned by auth.getUser() */
  setAuthUser: (user: Record<string, unknown> | null) => void;
  /** Direct reference to the query-builder object (for assertions) */
  queryBuilder: ReturnType<typeof buildQueryBuilder>;
}

// ---------------------------------------------------------------------------
// Internal builders
// ---------------------------------------------------------------------------

function buildQueryBuilder(getMockResponse: () => MockResponse) {
  const terminal = () => Promise.resolve(getMockResponse());

  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),

    // Terminal methods — resolve the mock response
    single: vi.fn().mockImplementation(terminal),
    maybeSingle: vi.fn().mockImplementation(terminal),
    then: undefined as unknown, // filled below
    csv: vi.fn().mockImplementation(terminal),
  };

  // Make the builder itself thenable so `await client.from(...).select(...)` works
  builder.then = vi.fn((resolve: (v: MockResponse) => void) =>
    terminal().then(resolve)
  );

  return builder;
}

function buildStorageBucket(getMockResponse: () => MockResponse) {
  return {
    createSignedUrl: vi.fn().mockImplementation((_path: string, _expiresIn: number) =>
      Promise.resolve(getMockResponse())
    ),
    getPublicUrl: vi.fn().mockImplementation((_path: string) => getMockResponse()),
    upload: vi.fn().mockImplementation((_path: string, _file: unknown) =>
      Promise.resolve(getMockResponse())
    ),
    download: vi.fn().mockImplementation((_path: string) =>
      Promise.resolve(getMockResponse())
    ),
    remove: vi.fn().mockImplementation((_paths: string[]) =>
      Promise.resolve(getMockResponse())
    ),
    list: vi.fn().mockImplementation(() => Promise.resolve(getMockResponse())),
  };
}

function buildClient(
  queryBuilder: ReturnType<typeof buildQueryBuilder>,
  getStorageBucket: () => ReturnType<typeof buildStorageBucket>,
  getAuthUser: () => Promise<{ data: { user: Record<string, unknown> | null }; error: null }>,
  getMockResponse: () => MockResponse,
) {
  return {
    from: vi.fn().mockReturnValue(queryBuilder),
    auth: {
      getUser: vi.fn().mockImplementation(getAuthUser),
      getSession: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: { session: null }, error: null })
      ),
      signInWithPassword: vi.fn().mockImplementation(() =>
        Promise.resolve(getMockResponse())
      ),
      signOut: vi.fn().mockImplementation(() =>
        Promise.resolve({ error: null })
      ),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    storage: {
      from: vi.fn().mockImplementation(() => getStorageBucket()),
    },
    rpc: vi.fn().mockImplementation(() => Promise.resolve(getMockResponse())),
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createMockSupabase(): MockSupabase {
  let mockResponse: MockResponse = { data: null, error: null };
  let authUser: Record<string, unknown> | null = null;

  const getMockResponse = () => mockResponse;
  const getAuthUser = () =>
    Promise.resolve({ data: { user: authUser }, error: null as null });

  const queryBuilder = buildQueryBuilder(getMockResponse);
  const storageBucket = buildStorageBucket(getMockResponse);
  const getStorageBucket = () => storageBucket;
  const client = buildClient(queryBuilder, getStorageBucket, getAuthUser, getMockResponse);

  return {
    client: client as unknown as ReturnType<typeof buildClient>,
    queryBuilder,
    setMockResponse(res: MockResponse) {
      mockResponse = res;
    },
    setAuthUser(user: Record<string, unknown> | null) {
      authUser = user;
    },
  };
}
