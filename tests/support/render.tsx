/**
 * React Component Test Utilities
 *
 * Custom render function and providers for testing React components
 * with proper tRPC, React Query, and session context.
 *
 * @module tests/support/render
 */

import React, { type ReactElement, type ReactNode } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** Mock session user for testing */
interface MockSessionUser {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  image: string | null;
}

/** Mock session for testing */
interface MockSession {
  user: MockSessionUser;
  expires: string;
}

/** Session context value type */
interface SessionContextValue {
  data: MockSession | null;
  status: "authenticated" | "unauthenticated" | "loading";
}

// Create a React context for the mock session
const MockSessionContext = React.createContext<SessionContextValue>({
  data: null,
  status: "unauthenticated",
});

/**
 * Hook to access the mock session in tests.
 * Mimics useSession from next-auth/react.
 */
export function useMockSession(): SessionContextValue {
  return React.useContext(MockSessionContext);
}

/**
 * Creates a new QueryClient configured for testing.
 * Disables retries and sets short cache times for predictable tests.
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry failed queries in tests
        gcTime: 0, // Garbage collect immediately
        staleTime: 0, // Always consider data stale
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** Options for the custom render function */
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  /** Mock session data. If provided, status will be "authenticated" */
  session?: MockSession | null;
  /** Initial session status. Defaults to "unauthenticated" if no session provided */
  sessionStatus?: "authenticated" | "unauthenticated" | "loading";
  /** Custom QueryClient. Creates a new test client if not provided */
  queryClient?: QueryClient;
}

/**
 * Test wrapper component that provides all necessary context providers.
 */
function createWrapper(options: CustomRenderOptions): React.FC<{ children: ReactNode }> {
  const {
    session = null,
    sessionStatus,
    queryClient = createTestQueryClient(),
  } = options;

  // Determine session status based on session data
  const status = sessionStatus ?? (session ? "authenticated" : "unauthenticated");

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MockSessionContext.Provider value={{ data: session, status }}>
          {children}
        </MockSessionContext.Provider>
      </QueryClientProvider>
    );
  };
}

/**
 * Custom render function that wraps components with test providers.
 *
 * Provides:
 * - QueryClientProvider with test-configured QueryClient
 * - Mock session context for authentication testing
 *
 * @param ui - React element to render
 * @param options - Render options including session and queryClient
 * @returns Render result with all testing-library utilities
 *
 * @example
 * ```typescript
 * // Render unauthenticated component
 * const { getByText } = renderWithProviders(<LoginButton />);
 *
 * // Render authenticated component
 * const { getByText } = renderWithProviders(<Dashboard />, {
 *   session: {
 *     user: { id: "usr_123", tenantId: "ten_456", email: "test@example.com", name: "Test", image: null },
 *     expires: new Date(Date.now() + 86400000).toISOString(),
 *   },
 * });
 *
 * // Render with loading session state
 * const { getByText } = renderWithProviders(<AuthGuard />, {
 *   sessionStatus: "loading",
 * });
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const Wrapper = createWrapper({ ...options, queryClient });

  const result = render(ui, { wrapper: Wrapper, ...options });

  return {
    ...result,
    queryClient,
  };
}

/**
 * Creates a mock session for testing authenticated components.
 *
 * @param overrides - Partial session data to override defaults
 * @returns Complete mock session
 *
 * @example
 * ```typescript
 * const session = createMockSession({
 *   user: { id: "usr_custom", tenantId: "ten_custom" },
 * });
 * ```
 */
export function createMockSession(
  overrides: Partial<{
    user: Partial<MockSessionUser>;
    expires: string;
  }> = {}
): MockSession {
  return {
    user: {
      id: "usr_test_123",
      tenantId: "ten_test_456",
      email: "test@example.com",
      name: "Test User",
      image: null,
      ...overrides.user,
    },
    expires: overrides.expires ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// Re-export testing-library utilities for convenience
export * from "@testing-library/react";

// Default export for simpler imports
export { renderWithProviders as render };
