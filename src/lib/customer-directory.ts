export type CustomerAccount = {
  id: string; name: string; email: string | null; registeredAt: string; providers: string[];
};
export type CustomerDirectoryPage = {
  customers: CustomerAccount[]; total: number; matching: number; page: number; perPage: number;
};
export type CustomerHistoryItem = {
  id: string; phone: string; kind: "product" | "request"; status: string; quantity: number | null; createdAt: string;
};
export type DirectoryResult = { directory: CustomerDirectoryPage; error?: never; code?: never } | { error: string; code: string; directory?: never };
export type CustomerDetailResult = {
  customer: CustomerAccount; history?: { orders: CustomerHistoryItem[]; page: number; hasMore: boolean }; historyError?: string; error?: never; code?: never;
} | { error: string; code: string; customer?: never; history?: never; historyError?: never };
export function accountSummary(user: {
  id: string; email?: string; created_at: string; user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>; identities?: { provider: string }[];
}): CustomerAccount {
  const metadata = user.user_metadata || {};
  const name = [metadata.full_name, metadata.name].find(value => typeof value === "string" && value.trim());
  const providers = [...(Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : []),
    user.app_metadata?.provider, ...(user.identities || []).map(identity => identity.provider)]
    .filter((provider): provider is string => typeof provider === "string" && provider.length > 0 && provider.length <= 40);
  return { id: user.id, name: typeof name === "string" ? name.trim().slice(0, 160) : "Name not provided",
    email: user.email || null, registeredAt: user.created_at, providers: [...new Set(providers)] };
}
