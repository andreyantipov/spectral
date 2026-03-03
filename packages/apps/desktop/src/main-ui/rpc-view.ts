import type { MainRPCSchema } from "@ctrl/core.shared";

export function defineRPC(Electroview: {
  defineRPC: <T>(config: any) => any;
}) {
  return Electroview.defineRPC<MainRPCSchema>({
    handlers: {
      requests: {},
      messages: {},
    },
  });
}
