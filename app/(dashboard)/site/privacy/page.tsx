import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | CVSD Go",
  description: "Privacy Policy for CVSD Go link directory and short-link services.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-4 inline-flex rounded-md border border-oxford-700 bg-oxford-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-oxford-600"
      >
        Go Home
      </Link>
      <article className="panel p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Policy</p>
        <h1 className="mt-3 font-serif text-3xl text-oxford-700 md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-600">Effective date: March 10, 2026</p>

        <section className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
          <p>
            Cedar Valley School District (&quot;District,&quot; &quot;we,&quot; &quot;our,&quot; &quot;us&quot;) values privacy and security. This
            Privacy Policy explains how CVSD Go collects, uses, shares, stores, and protects information when users
            access the link directory, short-link redirection services, and authenticated staff features.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">1. Information We Collect</h2>
          <p>Depending on your use of CVSD Go, we may collect:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Account identifiers for authenticated staff users (for example, user ID, display name, email).</li>
            <li>Administrative metadata (role flags, moderation actions, timestamps).</li>
            <li>Link records and operational fields (slug, destination URL, descriptions, schedules, access status).</li>
            <li>Technical usage events such as click counts, request timing, and security-related logs.</li>
            <li>Support submissions and comments entered through district support workflows.</li>
          </ul>

          <h2 className="text-lg font-semibold text-oxford-700">2. How We Use Information</h2>
          <p>We process information to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Provide directory search and secure redirection functionality.</li>
            <li>Administer links, folders, permissions, and support workflows.</li>
            <li>Detect misuse, protect users, and maintain system security.</li>
            <li>Investigate incidents and comply with legal or policy requirements.</li>
            <li>Improve service quality, reliability, and accessibility.</li>
          </ul>

          <h2 className="text-lg font-semibold text-oxford-700">3. Legal Basis and Education Context</h2>
          <p>
            CVSD Go is operated in an educational and public-service context. Processing may be based on public
            interest, legitimate educational operations, legal obligations, or user consent where required.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">4. Sharing and Disclosure</h2>
          <p>
            We do not sell personal information. We may share data with approved service providers (for example,
            hosting, authentication, and infrastructure providers) under contractual or legal safeguards.
          </p>
          <p>
            We may also disclose information when required by law, court order, records request obligations, or to
            protect the rights, safety, and security of students, staff, and systems.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">5. Data Retention</h2>
          <p>
            We retain information only as long as needed for operational, educational, legal, audit, and security
            purposes. Retention periods may vary by record type and applicable regulation.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">6. Security Measures</h2>
          <p>
            We apply administrative, technical, and organizational safeguards appropriate to the risk profile,
            including access controls, role-based permissions, logging, and infrastructure security practices.
          </p>
          <p>
            No internet service can be guaranteed fully secure, but we continuously review and improve controls.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">7. Children and Student Data</h2>
          <p>
            CVSD Go may be used by students and families to access district resources. Student information is handled
            in line with district obligations and applicable student privacy laws.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">8. Third-Party Links and Services</h2>
          <p>
            CVSD Go redirects users to internal and external destinations. Once redirected, privacy practices are
            governed by the destination site. Review third-party privacy notices before sharing personal data.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">9. Your Rights and Requests</h2>
          <p>
            Depending on applicable law, users may request access, correction, deletion, or restriction related to
            personal information processed through CVSD Go. We may need to verify identity before processing requests.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">10. Contact</h2>
          <p>
            Privacy questions, rights requests, and security concerns can be sent to{" "}
            <a className="font-semibold text-oxford-700 hover:underline" href="mailto:office@cvsd.live">
              office@cvsd.live
            </a>
            .
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">11. Policy Updates</h2>
          <p>
            We may update this Privacy Policy to reflect legal, operational, or technical changes. Updates will be
            posted on this page with a revised effective date.
          </p>
        </section>
      </article>
    </main>
  );
}
