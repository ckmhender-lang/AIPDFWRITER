"use client";

import * as React from "react";
import type { ContactFormState } from "../submitContact";

const initialState: ContactFormState = {
  ok: false,
  message: "",
  fieldErrors: {},
};

type Props = {
  action: (prevState: ContactFormState, formData: FormData) => Promise<ContactFormState>;
};

export function ContactForm({ action }: Props) {
  const [state, formAction, pending] = React.useActionState(action, initialState);

  return (
    <form action={formAction} className="grid">
      {state.message ? (
        <div className={`banner ${state.ok ? "success" : "danger"}`}>{state.message}</div>
      ) : null}

      <div className="grid two">
        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input
            className="input"
            id="name"
            name="name"
            placeholder="Ada Lovelace"
            autoComplete="name"
            aria-invalid={Boolean(state.fieldErrors.name) || undefined}
            aria-describedby={state.fieldErrors.name ? "name-error" : undefined}
          />
          {state.fieldErrors.name ? (
            <div className="error" id="name-error">
              {state.fieldErrors.name}
            </div>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            className="input"
            id="email"
            name="email"
            type="email"
            placeholder="ada@example.com"
            autoComplete="email"
            aria-invalid={Boolean(state.fieldErrors.email) || undefined}
            aria-describedby={state.fieldErrors.email ? "email-error" : undefined}
          />
          {state.fieldErrors.email ? (
            <div className="error" id="email-error">
              {state.fieldErrors.email}
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="message">
          Message
        </label>
        <textarea
          className="textarea"
          id="message"
          name="message"
          placeholder="What can we help with?"
          aria-invalid={Boolean(state.fieldErrors.message) || undefined}
          aria-describedby={state.fieldErrors.message ? "message-error" : undefined}
        />
        {state.fieldErrors.message ? (
          <div className="error" id="message-error">
            {state.fieldErrors.message}
          </div>
        ) : null}
      </div>

      <div className="row">
        <div className="p" style={{ margin: 0 }}>
          Fields are validated server-side.
        </div>
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
