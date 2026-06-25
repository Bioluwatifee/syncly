import type { Metadata } from "next";
import { LegalPageLayout, LegalIntro, LegalSection, ExternalLink } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Syncly",
  description: "How Syncly accesses, uses, and protects your information when transferring playlists between music streaming platforms.",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="June 19, 2026">
      <LegalIntro>
        Syncly (&ldquo;Syncly,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) provides a tool that helps you transfer
        playlists between music streaming services, including Spotify and YouTube Music. This Privacy
        Policy explains what information we access, how we use it, and the choices you have.
        <br /><br />
        By using Syncly, you agree to the practices described in this Privacy Policy.
      </LegalIntro>

      <LegalSection title="Use of YouTube API Services">
        <p>
          Syncly uses YouTube API Services to search for music tracks on YouTube and to create and
          populate playlists in your YouTube account on your behalf.
        </p>
        <p>
          By using Syncly, you are agreeing to be bound by the{" "}
          <ExternalLink href="https://www.youtube.com/t/terms">YouTube Terms of Service</ExternalLink>.
        </p>
        <p>
          This Privacy Policy incorporates and is subject to the{" "}
          <ExternalLink href="http://www.google.com/policies/privacy">Google Privacy Policy</ExternalLink>.
          Please review the Google Privacy Policy to understand how Google handles information accessed
          through its services.
        </p>
      </LegalSection>

      <LegalSection title="Information We Access and Use">
        <p>
          Syncly is designed to do one thing: move a playlist from one streaming service to another.
          To do this, when you connect your accounts, we access the following:
        </p>
        <p>
          <strong style={{ color: "#f0ede8" }}>Authorization data.</strong> When you connect Spotify and
          YouTube Music, those services provide Syncly with OAuth access tokens. These tokens allow
          Syncly to act on your behalf for the duration of your transfer — for example, to read a
          source playlist and to create a destination playlist.
        </p>
        <p>
          <strong style={{ color: "#f0ede8" }}>Playlist and track data.</strong> Syncly reads the
          playlists and tracks you choose to transfer (such as song titles, artists, and identifiers)
          so it can search for the matching songs on the destination service and recreate the playlist
          there.
        </p>
        <p>
          We use this information solely to perform the playlist transfer you request. We do not use
          it for advertising, profiling, or any purpose unrelated to the transfer.
        </p>
      </LegalSection>

      <LegalSection title="Data Storage and Retention">
        <p>
          Syncly does not require you to create an account, and we do not maintain a database of your
          personal information or your playlists.
        </p>
        <p>
          Access tokens and the playlist data needed for a transfer are held only temporarily, for the
          duration of your active session, so that the transfer can be completed. We do not retain your
          API Data after your session ends. When your session ends, the associated tokens and data are
          discarded.
        </p>
        <p>
          Because we do not store your data beyond your session, there is no long-lived copy of your
          information on our systems to refresh, update, or delete.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and Device Storage">
        <p>
          Syncly uses a session cookie (and similar browser storage) on your device to maintain your
          session — for example, to remember that you have connected a streaming service so you can
          disconnect and reconnect during the same session without starting over. This information is
          limited to operating the service and is not used to track you across other websites.
        </p>
      </LegalSection>

      <LegalSection title="How to Revoke Access and Delete Your Data">
        <p>
          You are in control of Syncly&apos;s access to your accounts at all times.
        </p>
        <p>
          <strong style={{ color: "#f0ede8" }}>Revoking access to your Google/YouTube account.</strong>{" "}
          You can revoke Syncly&apos;s access to your YouTube/Google account at any time through the
          Google security settings page at{" "}
          <ExternalLink href="https://myaccount.google.com/connections?filters=3,4&hl=en">
            myaccount.google.com/connections
          </ExternalLink>.
        </p>
        <p>
          <strong style={{ color: "#f0ede8" }}>Revoking access to your Spotify account.</strong> You can
          revoke Syncly&apos;s access to your Spotify account at any time from your Spotify account&apos;s
          &ldquo;Apps&rdquo; settings at{" "}
          <ExternalLink href="https://www.spotify.com/account/apps/">
            spotify.com/account/apps
          </ExternalLink>.
        </p>
        <p>
          <strong style={{ color: "#f0ede8" }}>Deleting your data.</strong> Because Syncly does not
          store your data beyond your active session, ending your session removes the associated
          tokens and data. If you have any questions about data deletion, you can contact us using the
          details below.
        </p>
      </LegalSection>

      <LegalSection title="Children's Privacy">
        <p>
          Syncly is not directed to children under the age of 13 (or the minimum age required in your
          country), and we do not knowingly collect personal information from children.
        </p>
      </LegalSection>

      <LegalSection title="Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will revise the
          &ldquo;Last updated&rdquo; date at the top of this page. Significant changes will be reflected
          on this page.
        </p>
      </LegalSection>

      <LegalSection title="Contact Us">
        <p>
          If you have any questions about this Privacy Policy or how Syncly handles your information,
          you can reach us at:
        </p>
        <p>
          <strong style={{ color: "#f0ede8" }}>Email:</strong>{" "}
          <a href="mailto:hello@synclyy.xyz">hello@synclyy.xyz</a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
