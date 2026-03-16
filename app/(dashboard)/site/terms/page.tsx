import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | CVSD Go",
  description: "Terms of Service for CVSD Go link directory and short-link services.",
};

export default function TermsOfServicePage() {
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
        <h1 className="mt-3 font-serif text-3xl text-oxford-700 md:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-600">Effective date: March 10, 2026</p>

        <section className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
          <p>
            These Terms of Service govern access to and use of CVSD Go, including the public link directory,
            short-link redirection, and staff administration tools operated by Cedar Valley School District
            (&quot;District,&quot; &quot;we,&quot; &quot;our,&quot; &quot;us&quot;). By using CVSD Go, you agree to these terms.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">1. Eligibility and Acceptable Use</h2>
          <p>
            CVSD Go is intended for students, families, staff, and community members seeking official district
            resources. You agree to use CVSD Go for lawful, educational, and administrative purposes only.
          </p>
          <p>You must not use CVSD Go to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Publish malicious, fraudulent, deceptive, or unlawful destinations.</li>
            <li>Interfere with platform availability, security, or integrity.</li>
            <li>Attempt unauthorized access to staff-only tools or protected links.</li>
            <li>Use the service to distribute spam, malware, or harmful content.</li>
          </ul>

          <h2 className="text-lg font-semibold text-oxford-700">2. Account and Access Controls</h2>
          <p>
            Some functions require authentication and role-based permissions. Staff users are responsible for
            safeguarding their credentials and for activities under their authenticated sessions.
          </p>
          <p>
            The District may modify, suspend, or remove user access if misuse, policy violations, or security risks
            are detected.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">3. Link Management and Content Responsibility</h2>
          <p>
            Authorized staff may create, edit, organize, schedule, lock, and remove short links. Staff users are
            responsible for verifying destination accuracy, appropriateness, and compliance with district policies.
          </p>
          <p>
            The District may remove or disable any link, folder, or redirect that is outdated, unsafe, inaccurate,
            or inconsistent with educational mission or legal obligations.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">4. Service Availability and Changes</h2>
          <p>
            CVSD Go is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We may change features, URLs, folder
            structures, access rules, or integrations at any time to improve service quality, safety, or compliance.
          </p>
          <p>
            We do not guarantee uninterrupted operation and may perform maintenance, updates, or emergency actions
            without prior notice.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">5. Third-Party Destinations</h2>
          <p>
            CVSD Go may redirect to third-party websites and services. The District does not control third-party
            terms, privacy practices, accessibility, or content after redirection. Users should review destination
            policies before submitting personal information.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">6. Security and Abuse Monitoring</h2>
          <p>
            To protect users and infrastructure, we may log technical events, monitor suspicious behavior, and audit
            administrative actions. Unauthorized testing, scraping, or attempts to bypass controls are prohibited.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">7. Intellectual Property</h2>
          <p>
            District names, logos, branding, and original materials in CVSD Go are owned by Cedar Valley School
            District or licensed to it. No right is granted to reproduce or distribute branded assets except as
            allowed by law or written permission.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">8. Disclaimer of Warranties and Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, the District disclaims warranties of merchantability, fitness for
            a particular purpose, and non-infringement regarding CVSD Go and linked destinations.
          </p>
          <p>
            The District is not liable for indirect, incidental, special, consequential, or exemplary damages arising
            from use of or inability to use CVSD Go, including losses associated with third-party sites.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">9. Governing Rules and Policy Alignment</h2>
          <p>
            These terms operate alongside district board policy, student/employee handbooks, and applicable federal
            and state law. If there is a conflict, legal and district policy requirements control.
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">10. Contact</h2>
          <p>
            Questions about these terms or user rights may be sent to{" "}
            <a className="font-semibold text-oxford-700 hover:underline" href="mailto:office@cvsd.live">
              office@cvsd.live
            </a>
            .
          </p>

          <h2 className="text-lg font-semibold text-oxford-700">11. Updates to These Terms</h2>
          <p>
            We may revise these Terms of Service. Material changes will be posted on this page with an updated
            effective date.
          </p>
        </section>
      </article>
    </main>
  );
}
