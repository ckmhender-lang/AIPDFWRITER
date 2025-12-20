import { submitContact } from "./submitContact";
import { ContactForm } from "./ui/ContactForm";

export default function Page() {
  return (
    <section className="card">
      <h1 className="h1">Contact form</h1>
      <p className="p">
        This is a simple Next.js form UI using a server action. Submissions are validated server-side and logged to the
        server console.
      </p>

      <ContactForm action={submitContact} />
    </section>
  );
}
