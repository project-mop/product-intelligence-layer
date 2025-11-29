"use client";

import { EnvironmentBadge } from "~/components/process/EnvironmentBadge";

type EnvironmentType = "SANDBOX" | "PRODUCTION";

interface ApiKeyData {
  id: string;
  name: string;
  environment: EnvironmentType;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

interface EnvironmentKeyGroupProps {
  environment: EnvironmentType;
  keys: ApiKeyData[];
  onRevoke: (keyId: string) => void;
  onRotate: (keyId: string) => void;
}

function formatDate(date: Date | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(date: Date | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const headerStyles = {
  SANDBOX:
    "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300",
  PRODUCTION:
    "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300",
};

const descriptions = {
  SANDBOX: "For testing with /api/v1/sandbox/... endpoints",
  PRODUCTION: "For live traffic with /api/v1/intelligence/... endpoints",
};

/**
 * EnvironmentKeyGroup Component
 *
 * Displays a group of API keys for a specific environment (SANDBOX or PRODUCTION).
 * Shows environment header with appropriate color and lists keys with actions.
 *
 * @see Story 5.2 AC: 2, 8
 */
export function EnvironmentKeyGroup({
  environment,
  keys,
  onRevoke,
  onRotate,
}: EnvironmentKeyGroupProps) {
  return (
    <div className="space-y-4">
      {/* Environment Header */}
      <div className={`rounded-lg border p-4 ${headerStyles[environment]}`}>
        <h3 className="font-semibold">
          {environment === "SANDBOX" ? "Sandbox Keys" : "Production Keys"}
        </h3>
        <p className="mt-1 text-sm opacity-80">{descriptions[environment]}</p>
      </div>

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">
            No {environment.toLowerCase()} keys yet
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Create a {environment.toLowerCase()} key to get started
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Last Used
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Expires
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {keys.map((key) => {
                const isExpired =
                  key.expiresAt && new Date(key.expiresAt) < new Date();

                return (
                  <tr key={key.id}>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {key.name}
                        </span>
                        <EnvironmentBadge environment={environment} size="sm" />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                      {formatDate(key.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                      {formatDateTime(key.lastUsedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                      {key.expiresAt ? (
                        <span className={isExpired ? "text-red-600" : undefined}>
                          {formatDate(key.expiresAt)}
                        </span>
                      ) : (
                        "Never"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {isExpired ? (
                        <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                          Expired
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onRotate(key.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Rotate
                        </button>
                        <button
                          onClick={() => onRevoke(key.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
