/**
 * Test Setup
 *
 * Global test configuration and setup
 */

import "@testing-library/dom";
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

// Mock ResizeObserver for Radix UI components
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

// Mock PointerEvent for Radix UI components (Select, etc.)
class PointerEventMock extends Event {
  button: number;
  ctrlKey: boolean;
  pointerType: string;

  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props);
    this.button = props.button ?? 0;
    this.ctrlKey = props.ctrlKey ?? false;
    this.pointerType = props.pointerType ?? "mouse";
  }
}
global.PointerEvent = PointerEventMock as unknown as typeof PointerEvent;

// Mock window.scrollTo for Radix UI ScrollArea
Object.defineProperty(window, "scrollTo", { value: vi.fn(), writable: true });

// Mock matchMedia for responsive components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Reset all mocks after each test
afterEach(() => {
  vi.resetAllMocks();
});

// Mock environment variables for tests
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.AUTH_SECRET = "test-secret-for-testing";
process.env.NEXTAUTH_URL = "http://localhost:3000";
