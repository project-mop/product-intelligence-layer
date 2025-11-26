/**
 * Example Component Test
 *
 * Demonstrates the component testing pattern with custom render function
 * and mock session provider. This test file serves as documentation
 * for how to write component tests in this project.
 *
 * @module tests/unit/components/example.test
 */

import React from "react";
import { describe, expect, it } from "vitest";
import {
  renderWithProviders,
  createMockSession,
  useMockSession,
  screen,
} from "../../support/render";

// Example component that uses session
function UserGreeting() {
  const { data: session, status } = useMockSession();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <div>Please sign in</div>;
  }

  return <div>Welcome, {session.user.name}!</div>;
}

// Example component with conditional rendering
function AuthStatus() {
  const { status } = useMockSession();

  return (
    <div data-testid="auth-status">
      Status: {status}
    </div>
  );
}

describe("Component Testing Example", () => {
  describe("UserGreeting", () => {
    it("should show sign in prompt when unauthenticated", () => {
      renderWithProviders(<UserGreeting />);

      expect(screen.getByText("Please sign in")).toBeInTheDocument();
    });

    it("should show welcome message when authenticated", () => {
      const session = createMockSession({
        user: { name: "Alice" },
      });

      renderWithProviders(<UserGreeting />, { session });

      expect(screen.getByText("Welcome, Alice!")).toBeInTheDocument();
    });

    it("should show loading state when session is loading", () => {
      renderWithProviders(<UserGreeting />, {
        sessionStatus: "loading",
      });

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("AuthStatus", () => {
    it("should display unauthenticated status by default", () => {
      renderWithProviders(<AuthStatus />);

      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "Status: unauthenticated"
      );
    });

    it("should display authenticated status with session", () => {
      const session = createMockSession();
      renderWithProviders(<AuthStatus />, { session });

      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "Status: authenticated"
      );
    });

    it("should display loading status", () => {
      renderWithProviders(<AuthStatus />, {
        sessionStatus: "loading",
      });

      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "Status: loading"
      );
    });
  });

  describe("Custom Session Data", () => {
    it("should use custom user data from session", () => {
      const session = createMockSession({
        user: {
          id: "usr_custom_123",
          tenantId: "ten_custom_456",
          email: "custom@example.com",
          name: "Custom User",
        },
      });

      renderWithProviders(<UserGreeting />, { session });

      expect(screen.getByText("Welcome, Custom User!")).toBeInTheDocument();
    });

    it("should handle null name gracefully", () => {
      const session = createMockSession({
        user: { name: null },
      });

      renderWithProviders(<UserGreeting />, { session });

      // Component should render with null name
      expect(screen.getByText("Welcome, !")).toBeInTheDocument();
    });
  });

  describe("QueryClient Integration", () => {
    it("should provide QueryClient through wrapper", async () => {
      // This test demonstrates that the QueryClient is available
      // In real tests, you'd use this with tRPC hooks

      function QueryTest() {
        // In a real component, you'd use tRPC queries here
        // For example: const { data } = api.post.list.useQuery();
        return <div>Query client available</div>;
      }

      const { queryClient } = renderWithProviders(<QueryTest />);

      // QueryClient should be accessible from render result
      expect(queryClient).toBeDefined();
      expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
    });
  });
});
