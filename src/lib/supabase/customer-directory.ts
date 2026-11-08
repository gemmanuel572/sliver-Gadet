import "server-only";

import { accountSummary, type CustomerDirectoryPage } from "@/lib/customer-directory";
import { countRegisteredAuthUsers, createSupabaseAdminClient, CustomerCountError } from "./admin";

const PAGE_SIZE = 25;

export async function readCustomerDirectory(page: number, query: string): Promise<CustomerDirectoryPage> {
  const client = createSupabaseAdminClient();
  if (!query) {
    const total = await countRegisteredAuthUsers();
    const current = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
    const { data, error } = await client.auth.admin.listUsers({ page: current, perPage: PAGE_SIZE });
    if (error) throw new CustomerCountError("DIRECTORY_UNAVAILABLE", "Could not retrieve registered accounts. Please refresh the list.");
    return { customers: data.users.map(accountSummary), total, matching: total, page: current, perPage: PAGE_SIZE };
  }
  // Auth's listUsers API does not offer a global name/email search. Scan bounded
  // API pages on the server and return only one page of sanitized matches.
  const selected = [];
  let total = 0; let matching = 0;
  for (let current = 1; ; current++) {
    const { data, error } = await client.auth.admin.listUsers({ page: current, perPage: 1000 });
    if (error) throw new CustomerCountError("DIRECTORY_UNAVAILABLE", "The customer search could not finish. No partial results were returned; please retry.");
    total += data.users.length;
    for (const user of data.users) {
      const customer = accountSummary(user);
      if (!`${customer.name} ${customer.email || ""}`.toLowerCase().includes(query.toLowerCase())) continue;
      if (matching >= (page - 1) * PAGE_SIZE && selected.length < PAGE_SIZE) selected.push(customer);
      matching++;
    }
    if (data.users.length < 1000) break;
  }
  return { customers: selected, total, matching, page, perPage: PAGE_SIZE };
}

export async function readCustomerAccount(id: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.auth.admin.getUserById(id);
  if (error || !data.user) throw new CustomerCountError("CUSTOMER_NOT_FOUND", "This customer account could not be found. Return to the customer list and refresh.");
  return accountSummary(data.user);
}
