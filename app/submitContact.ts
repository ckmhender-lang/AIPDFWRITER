"use server";

export type ContactFormState = {
  ok: boolean;
  message: string;
  fieldErrors: Partial<Record<"name" | "email" | "message", string>>;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export async function submitContact(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const name = asString(formData.get("name")).trim();
  const email = asString(formData.get("email")).trim();
  const message = asString(formData.get("message")).trim();

  const fieldErrors: ContactFormState["fieldErrors"] = {};

  if (name.length < 2) fieldErrors.name = "Please enter your name (at least 2 characters).";
  if (!emailRegex.test(email)) fieldErrors.email = "Please enter a valid email address.";
  if (message.length < 10) fieldErrors.message = "Please enter a message (at least 10 characters).";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors,
    };
  }

  // Simulate async work (e.g. saving to DB, sending email)
  await new Promise((r) => setTimeout(r, 400));

  console.log("New contact submission:", {
    name,
    email,
    message,
    submittedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    message: "Thanks — your message was sent.",
    fieldErrors: {},
  };
}
