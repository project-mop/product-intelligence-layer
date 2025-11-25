"use client";

import { api } from "~/trpc/react";

export function HelloMessage() {
  const [hello] = api.post.hello.useSuspenseQuery({ text: "from client" });

  return (
    <div className="w-full max-w-xs">
      <p className="text-center">{hello.greeting}</p>
    </div>
  );
}

export function SecretMessage() {
  const [secret] = api.post.getSecretMessage.useSuspenseQuery();

  return (
    <div className="w-full max-w-xs">
      <p className="text-center text-green-400">{secret}</p>
    </div>
  );
}
