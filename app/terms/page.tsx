import type { Metadata } from "next";
import { LegalPageLayout, LegalIntro, LegalSection, ExternalLink } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms of Use — Syncly",
  description: "The terms governing your use of Syncly to transfer playlists between music streaming platforms.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Use" lastUpdated="June 19, 2026">
      <LegalIntro>
        Welcome to Syncly. These Terms of Use (&ldquo;Terms&rdquo;) govern your use of Syncly
        (&ldquo;Syncly,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), a tool that helps you
        transfer playlists between music streaming services, including Spotify and YouTube Music. By
        using Syncly, you agree to these Terms. If you do not agree, please do not use Syncly.
      </LegalIntro>

      <LegalSection title="Use of YouTube API Services">
        <p>Syncly uses YouTube API Services to provide its functionality.</p>
        <p>
          <strong style={{ color: "#f0ede8" }}>
            By using Syncly, you are agreeing to be bound by the{" "}
            <ExternalLink href="https://www.youtube.com/t/terms">YouTube Terms of Service</ExternalLink>.
          </strong>
        </p>
        <p>
          Your use of YouTube API Services through Syncly is also subject to the{" "}
          <ExternalLink href="http://www.google.com/policies/privacy">Google Privacy Policy</ExternalLink>.
        </p>
      </LegalSection>

      <LegalSection title="What Syncly Does">
        <p>
          Syncly allows you to connect your music streaming accounts and transfer a playlist from one
          service to another. When you connect your accounts, you authorize Syncly to access your
          playlists and create playlists on your behalf solely to perform the transfer you request.
        </p>
        <p>
          You are responsible for ensuring you have the right to access and transfer the content in
          the playlists you choose to move.
        </p>
      </LegalSection>

      <LegalSection title="Your Responsibilities">
        <p>When using Syncly, you agree that you will:</p>
        <ul>
          <li>Use Syncly only for lawful purposes and in accordance with these Terms.</li>
          <li>Comply with the terms of service of any third-party platform you connect, including Spotify and YouTube.</li>
          <li>Not attempt to disrupt, abuse, reverse engineer, or misuse the service or its underlying APIs.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Third-Party Services">
        <p>
          Syncly works with third-party services such as Spotify and YouTube Music. Your use of those
          services is governed by their own terms and policies. Syncly is not responsible for the
          availability, content, or practices of third-party services, and we are not affiliated with
          or endorsed by them.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer">
        <p>
          Syncly is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of
          any kind, whether express or implied. We do not guarantee that every track will be matched,
          that transfers will be error-free, or that the service will be uninterrupted. Music
          availability differs between platforms, and some tracks may not have an exact match on the
          destination service.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of Liability">
        <p>
          To the fullest extent permitted by law, Syncly and its creator will not be liable for any
          indirect, incidental, or consequential damages arising out of or related to your use of the
          service.
        </p>
      </LegalSection>

      <LegalSection title="Changes to These Terms">
        <p>
          We may update these Terms from time to time. When we do, we will revise the &ldquo;Last
          updated&rdquo; date at the top of this page. Your continued use of Syncly after changes are
          posted means you accept the updated Terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact Us">
        <p>If you have any questions about these Terms, you can reach us at:</p>
        <p>
          <strong style={{ color: "#f0ede8" }}>Email:</strong>{" "}
          <a href="mailto:hello@synclyy.xyz">hello@synclyy.xyz</a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
