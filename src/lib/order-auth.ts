import { createClient } from "@/lib/supabase/client";

const DRAFT_KEY = "silva-pending-order";

// Check whether the customer is logged in.
export async function ensureSignedIn(
  form: HTMLFormElement
): Promise<boolean> {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Stop if Supabase cannot verify the account.
  if (
    error &&
    error.name !== "AuthSessionMissingError" &&
    error.code !== "session_not_found"
  ) {
    alert(
      "We could not verify your account. Please try again."
    );
    return false;
  }

  // A signed-in customer can proceed.
  if (user) {
    return true;
  }

  // Save the current page.
  const currentPage =
    window.location.pathname + window.location.search;

  // Save the form information temporarily.
  const fields: [string, string][] = [];

  for (const [name, value] of new FormData(form).entries()) {
    if (typeof value === "string") {
      fields.push([name, value]);
    }
  }

  try {
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        page: currentPage,
        fields,
      })
    );
  } catch {
    alert(
      "Your browser could not save the form. " +
        "You may need to fill it in again after signing in."
    );
  }

  alert(
    "You need an account to place an order.\n\n" +
      "Please sign in or create an account with Google.\n\n" +
      "After signing in, you will return to this phone."
  );

  // Redirect to Google sign-in.
  window.location.assign(
    `/login?next=${encodeURIComponent(currentPage)}`
  );

  return false;
}

// Restore previously entered information after login.
export function restorePendingOrder(
  form: HTMLFormElement
): void {
  const saved = window.sessionStorage.getItem(DRAFT_KEY);

  if (!saved) return;

  try {
    const draft = JSON.parse(saved) as {
      page: string;
      fields: [string, string][];
    };

    const currentPage =
      window.location.pathname + window.location.search;

    // Only restore details on the correct page.
    if (draft.page !== currentPage) return;

    for (const [name, value] of draft.fields) {
      const field = form.elements.namedItem(name);

      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement
      ) {
        field.value = value;
      }
    }

    // Remove temporary information after restoration.
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    window.sessionStorage.removeItem(DRAFT_KEY);
  }
}