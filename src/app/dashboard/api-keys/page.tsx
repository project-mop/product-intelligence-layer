"use client";

import { useState } from "react";

import { api } from "~/trpc/react";

type EnvironmentType = "SANDBOX" | "PRODUCTION";

interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (plainTextKey: string) => void;
}

function CreateKeyModal({ isOpen, onClose, onCreated }: CreateKeyModalProps) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<EnvironmentType>("SANDBOX");

  const createKey = api.apiKey.create.useMutation({
    onSuccess: (data) => {
      onCreated(data.plainTextKey);
      setName("");
      setEnvironment("SANDBOX");
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createKey.mutate({ name, environment });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Create API Key
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="keyName"
              className="block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <input
              id="keyName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production API Key"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="environment"
              className="block text-sm font-medium text-gray-700"
            >
              Environment
            </label>
            <select
              id="environment"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as EnvironmentType)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="SANDBOX">Sandbox (Test)</option>
              <option value="PRODUCTION">Production (Live)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Sandbox keys have prefix pil_test_, Production keys have pil_live_
            </p>
          </div>

          {createKey.error && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-700">{createKey.error.message}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createKey.isPending || !name.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createKey.isPending ? "Creating..." : "Create Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface KeyDisplayModalProps {
  isOpen: boolean;
  plainTextKey: string;
  onClose: () => void;
}

function KeyDisplayModal({ isOpen, plainTextKey, onClose }: KeyDisplayModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(plainTextKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-full bg-yellow-100 p-2">
            <svg
              className="h-5 w-5 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Save Your API Key
          </h2>
        </div>

        <div className="mb-4 rounded-md bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            <strong>Important:</strong> This is the only time you will see this
            key. Copy it now and store it securely. You will not be able to
            retrieve it later.
          </p>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Your API Key
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={plainTextKey}
              className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm"
            />
            <button
              onClick={handleCopy}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            I&apos;ve Saved My Key
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  confirmVariant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  confirmVariant = "danger",
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const confirmButtonClass =
    confirmVariant === "danger"
      ? "bg-red-600 hover:bg-red-500"
      : "bg-yellow-600 hover:bg-yellow-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-xl font-semibold text-gray-900">{title}</h2>
        <p className="mb-6 text-sm text-gray-600">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${confirmButtonClass}`}
          >
            {isLoading ? "Processing..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
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

export default function ApiKeysPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyToShow, setNewKeyToShow] = useState<string | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null);
  const [keyToRotate, setKeyToRotate] = useState<string | null>(null);

  const utils = api.useUtils();

  const { data: keys, isLoading, error } = api.apiKey.list.useQuery();

  const revokeKey = api.apiKey.revoke.useMutation({
    onSuccess: () => {
      void utils.apiKey.list.invalidate();
      setKeyToRevoke(null);
    },
  });

  const rotateKey = api.apiKey.rotate.useMutation({
    onSuccess: (data) => {
      void utils.apiKey.list.invalidate();
      setKeyToRotate(null);
      setNewKeyToShow(data.plainTextKey);
    },
  });

  const handleKeyCreated = (plainTextKey: string) => {
    setShowCreateModal(false);
    setNewKeyToShow(plainTextKey);
    void utils.apiKey.list.invalidate();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">
              Failed to load API keys: {error.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your API keys for accessing the Product Intelligence Layer
              API
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Create API Key
          </button>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow">
          {isLoading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">Loading API keys...</p>
            </div>
          ) : !keys || keys.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No API keys yet</p>
              <p className="mt-1 text-sm text-gray-400">
                Create your first API key to get started
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Environment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Last Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {keys.map((key) => {
                  const isRevoked = !!key.revokedAt;
                  const isExpired =
                    key.expiresAt && new Date(key.expiresAt) < new Date();

                  return (
                    <tr
                      key={key.id}
                      className={isRevoked ? "bg-gray-50" : undefined}
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={
                            isRevoked
                              ? "text-gray-400 line-through"
                              : "font-medium text-gray-900"
                          }
                        >
                          {key.name}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            key.environment === "PRODUCTION"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {key.environment === "PRODUCTION" ? "Live" : "Test"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDate(key.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDateTime(key.lastUsedAt)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {key.expiresAt ? (
                          <span
                            className={
                              isExpired ? "text-red-600" : undefined
                            }
                          >
                            {formatDate(key.expiresAt)}
                          </span>
                        ) : (
                          "Never"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {isRevoked ? (
                          <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                            Revoked
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        {!isRevoked && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setKeyToRotate(key.id)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Rotate
                            </button>
                            <button
                              onClick={() => setKeyToRevoke(key.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleKeyCreated}
      />

      <KeyDisplayModal
        isOpen={!!newKeyToShow}
        plainTextKey={newKeyToShow ?? ""}
        onClose={() => setNewKeyToShow(null)}
      />

      <ConfirmDialog
        isOpen={!!keyToRevoke}
        title="Revoke API Key"
        message="Are you sure you want to revoke this API key? This action cannot be undone. Any applications using this key will immediately lose access."
        confirmText="Revoke Key"
        confirmVariant="danger"
        isLoading={revokeKey.isPending}
        onConfirm={() => keyToRevoke && revokeKey.mutate({ id: keyToRevoke })}
        onCancel={() => setKeyToRevoke(null)}
      />

      <ConfirmDialog
        isOpen={!!keyToRotate}
        title="Rotate API Key"
        message="Are you sure you want to rotate this API key? The current key will be immediately revoked and a new key will be generated. Make sure to update your applications with the new key."
        confirmText="Rotate Key"
        confirmVariant="warning"
        isLoading={rotateKey.isPending}
        onConfirm={() => keyToRotate && rotateKey.mutate({ id: keyToRotate })}
        onCancel={() => setKeyToRotate(null)}
      />
    </div>
  );
}
