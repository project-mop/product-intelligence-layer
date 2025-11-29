"use client";

import { useState } from "react";

import { api } from "~/trpc/react";
import { EnvironmentKeyGroup } from "~/components/api-keys/EnvironmentKeyGroup";
import { EnvironmentBadge } from "~/components/process/EnvironmentBadge";

type EnvironmentType = "SANDBOX" | "PRODUCTION";

interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (plainTextKey: string, environment: EnvironmentType) => void;
}

const environmentInstructions = {
  SANDBOX: {
    title: "Sandbox Key",
    description: "Use for testing and development",
    endpoint: "/api/v1/sandbox/intelligence/[processId]/generate",
    prefix: "pil_test_",
    note: "Sandbox keys can only access sandbox endpoints. Perfect for testing your integration without affecting production data.",
  },
  PRODUCTION: {
    title: "Production Key",
    description: "Use for live traffic",
    endpoint: "/api/v1/intelligence/[processId]/generate",
    prefix: "pil_live_",
    note: "Production keys can only access production endpoints. Use for your live application.",
  },
};

function CreateKeyModal({ isOpen, onClose, onCreated }: CreateKeyModalProps) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<EnvironmentType>("SANDBOX");

  const createKey = api.apiKey.create.useMutation({
    onSuccess: (data) => {
      onCreated(data.plainTextKey, environment);
      setName("");
      setEnvironment("SANDBOX");
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createKey.mutate({ name, environment });
  };

  const instructions = environmentInstructions[environment];

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
              placeholder="e.g., My Integration Key"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Environment Selection with Radio Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Environment
            </label>
            <div className="mt-2 space-y-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  environment === "SANDBOX"
                    ? "border-yellow-400 bg-yellow-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="environment"
                  value="SANDBOX"
                  checked={environment === "SANDBOX"}
                  onChange={() => setEnvironment("SANDBOX")}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">Sandbox</span>
                    <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">
                      Test
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">
                    For testing with /api/v1/sandbox/... endpoints
                  </p>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  environment === "PRODUCTION"
                    ? "border-green-400 bg-green-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="environment"
                  value="PRODUCTION"
                  checked={environment === "PRODUCTION"}
                  onChange={() => setEnvironment("PRODUCTION")}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">Production</span>
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                      Live
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">
                    For live traffic with /api/v1/intelligence/... endpoints
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Environment-specific instructions */}
          <div
            className={`rounded-md p-3 ${
              environment === "SANDBOX"
                ? "bg-yellow-50 text-yellow-800"
                : "bg-green-50 text-green-800"
            }`}
          >
            <p className="text-sm">
              <strong>Key prefix:</strong>{" "}
              <code className="rounded bg-white/50 px-1 font-mono text-xs">
                {instructions.prefix}
              </code>
            </p>
            <p className="mt-1 text-sm">{instructions.note}</p>
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
              className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                environment === "SANDBOX"
                  ? "bg-yellow-600 hover:bg-yellow-500"
                  : "bg-green-600 hover:bg-green-500"
              }`}
            >
              {createKey.isPending
                ? "Creating..."
                : `Create ${environment === "SANDBOX" ? "Sandbox" : "Production"} Key`}
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
  environment: EnvironmentType;
  onClose: () => void;
}

function KeyDisplayModal({
  isOpen,
  plainTextKey,
  environment,
  onClose,
}: KeyDisplayModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(plainTextKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const instructions = environmentInstructions[environment];

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
          <EnvironmentBadge environment={environment} size="md" />
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

        {/* Usage Example */}
        <div className="mb-4 rounded-md bg-gray-100 p-3">
          <p className="mb-1 text-xs font-medium uppercase text-gray-500">
            Example Endpoint
          </p>
          <code className="block text-sm text-gray-700">
            POST {instructions.endpoint}
          </code>
          <p className="mt-2 text-xs font-medium uppercase text-gray-500">
            Header
          </p>
          <code className="block text-sm text-gray-700">
            Authorization: Bearer {instructions.prefix}...
          </code>
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

export default function ApiKeysPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyToShow, setNewKeyToShow] = useState<{
    key: string;
    environment: EnvironmentType;
  } | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null);
  const [keyToRotate, setKeyToRotate] = useState<{
    id: string;
    environment: EnvironmentType;
  } | null>(null);

  const utils = api.useUtils();

  // Use listByEnvironment for grouped display (Story 5.2)
  const {
    data: keysByEnvironment,
    isLoading,
    error,
  } = api.apiKey.listByEnvironment.useQuery();

  const revokeKey = api.apiKey.revoke.useMutation({
    onSuccess: () => {
      void utils.apiKey.listByEnvironment.invalidate();
      setKeyToRevoke(null);
    },
  });

  const rotateKey = api.apiKey.rotate.useMutation({
    onSuccess: (data) => {
      void utils.apiKey.listByEnvironment.invalidate();
      const env = keyToRotate?.environment ?? "SANDBOX";
      setKeyToRotate(null);
      setNewKeyToShow({ key: data.plainTextKey, environment: env });
    },
  });

  const handleKeyCreated = (plainTextKey: string, environment: EnvironmentType) => {
    setShowCreateModal(false);
    setNewKeyToShow({ key: plainTextKey, environment });
    void utils.apiKey.listByEnvironment.invalidate();
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
              API. Keys are scoped to a specific environment.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Create API Key
          </button>
        </div>

        {isLoading ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <p className="text-gray-500">Loading API keys...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Sandbox Keys Section */}
            <EnvironmentKeyGroup
              environment="SANDBOX"
              keys={keysByEnvironment?.sandbox ?? []}
              onRevoke={(keyId) => setKeyToRevoke(keyId)}
              onRotate={(keyId) =>
                setKeyToRotate({ id: keyId, environment: "SANDBOX" })
              }
            />

            {/* Production Keys Section */}
            <EnvironmentKeyGroup
              environment="PRODUCTION"
              keys={keysByEnvironment?.production ?? []}
              onRevoke={(keyId) => setKeyToRevoke(keyId)}
              onRotate={(keyId) =>
                setKeyToRotate({ id: keyId, environment: "PRODUCTION" })
              }
            />
          </div>
        )}
      </div>

      <CreateKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleKeyCreated}
      />

      <KeyDisplayModal
        isOpen={!!newKeyToShow}
        plainTextKey={newKeyToShow?.key ?? ""}
        environment={newKeyToShow?.environment ?? "SANDBOX"}
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
        onConfirm={() =>
          keyToRotate && rotateKey.mutate({ id: keyToRotate.id })
        }
        onCancel={() => setKeyToRotate(null)}
      />
    </div>
  );
}
