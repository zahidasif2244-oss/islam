import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Quran Web',
  description: 'Privacy Policy for Quran Web — what data we collect, how we use it, and your rights.',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-[#e0e0e0]">
        <h1 className="text-2xl font-bold text-[#1a5c3a] mb-2">Privacy Policy</h1>
        <p className="text-xs text-[#999] mb-6">Last updated: August 2026 · Applies to the Quran Web website (islam-pearl-zeta.vercel.app)</p>

        <div className="space-y-5 text-sm text-[#444] leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-[#1a5c3a] mb-1.5">1. Overview</h2>
            <p>This Privacy Policy explains what information Quran Web (&quot;we&quot;, &quot;us&quot;) collects when you visit our website, how it is used, and the choices you have. By using the website you agree to this policy.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1a5c3a] mb-1.5">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Automatically collected data:</b> standard server logs (IP address, browser type, pages visited, timestamps) and anonymized analytics data.</li>
              <li><b>Local storage:</b> settings such as your preferred translation, bookmarks (surahs, ayahs, hadiths) and book selections are stored only in your own browser (localStorage) and never sent to our servers.</li>
              <li><b>No accounts:</b> the site has no user accounts, email signups or profiles. We do not collect your name, email or phone number.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1a5c3a] mb-1.5">3. How We Use Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To operate, maintain and improve the website and its content.</li>
              <li>To understand aggregate usage (e.g. popular surahs, books, duas) so we can improve the experience.</li>
              <li>To keep the site secure and prevent abuse.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1a5c3a] mb-1.5">4. Cookies &amp; Advertising</h2>
            <p>We may use cookies or similar technologies for core site functions (e.g. remembering your settings) and, in the future, for advertising. If we serve ads, third-party advertising partners (such as Google AdSense) may use cookies to serve ads based on your prior visits to this and other websites. Google&apos;s use of advertising cookies enables it and its partners to serve ads based on your visits to this site and other sites on the internet.</p>
            <p className="mt-2">You can opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-[#1a5c3a] underline">Google&apos;s Ads Settings</a> or <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer" className="text-[#1a5c3a] underline">aboutads.info</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1a5c3a] mb-1.5">5. Third-Party Links</h2>
            <p>The website may link to external sites (e.g. book downloads, child websites, reference sources). We are not responsible for the privacy practices or content of those third-party sites. We encourage you to read their privacy policies.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1a5c3a] mb-1.5">6. Data Security</h2>
            <p>We take reasonable technical and organizational measures to protect any data transmitted to our servers. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1a5c3a] mb-1.5">7. Children&apos;s Privacy</h2>
            <p>This website is a religious content resource. We do not knowingly collect personal information from children under 13. If you believe a child has provided us personal information, please contact us and we will delete it.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1a5c3a] mb-1.5">8. Your Choices &amp; Rights</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Clear your browser&apos;s local storage / bookmarks anytime from your browser settings.</li>
              <li>Use your browser&apos;s privacy settings to block or delete cookies.</li>
              <li>Opt out of personalized ads as described in section 4.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1a5c3a] mb-1.5">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated &quot;Last updated&quot; date.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1a5c3a] mb-1.5">10. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at the email address shown in the site&apos;s About section.</p>
          </section>
        </div>
      </div>
    </div>
  )
}