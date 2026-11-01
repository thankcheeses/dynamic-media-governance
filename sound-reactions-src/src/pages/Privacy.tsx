import { Link } from 'react-router-dom'

const REPO = 'https://github.com/thankcheeses/dynamic-media-governance'

/** Plain-language privacy notice for the prototype. Keep it true: update it when storage or network behaviour changes. */
export default function Privacy() {
  return <article className="x-page privacy-notice">
    <header className="x-timeline-header"><h1>Privacy notice</h1></header>
    <section>
      <p><strong>Short version:</strong> this is a concept prototype that runs entirely in your browser. There is no account, no server of ours, and nothing you do here is sent anywhere. It is not affiliated with X.</p>

      <h2>What this site stores on your device</h2>
      <ul>
        <li><strong>Demo settings and activity</strong> (sound settings, the fictional feed’s likes and bookmarks, governance settings, the local audit log) in your browser’s local storage under <code>sound-reactions-demo-v3</code>.</li>
        <li><strong>“Make it yours” details</strong> (a name, handle, bio and a small photo you type in) under <code>sound-reactions-identity</code>.</li>
        <li><strong>A GIPHY API key</strong>, only if you type your own into the header studio, under <code>sound-reactions-giphy-key</code>.</li>
      </ul>
      <p>All of this stays in your browser. You can remove it with <Link to="/settings">Reset demo</Link> or by clearing site data.</p>

      <h2>Your X archive (“Preview with your X archive”)</h2>
      <ul>
        <li>The archive zip is read by code running in your browser. It is never uploaded; we have no server that could receive it.</li>
        <li>Only your profile, your posts, your likes, and images inside the zip are used. Your email address, direct messages, contacts, ad data and everything else in the archive are not read.</li>
        <li>It is held in memory only: it is not written to local storage, and it is gone when you close the tab, reload, or choose <strong>Clear my import</strong>.</li>
        <li>Nothing here reads from or writes to your X account. There is no login.</li>
      </ul>

      <h2>Network requests this site makes</h2>
      <ul>
        <li><strong>GIPHY and Tenor</strong>, to fetch the GIF banners shown on the fictional profiles and the owner’s profile, and GIPHY search results when you use the header studio. Those services see the request like any image load.</li>
        <li><strong>GitHub Pages</strong>, which hosts the site itself.</li>
        <li>No analytics, no advertising scripts, no third-party fonts or trackers. A Content Security Policy on the page limits where it may connect.</li>
      </ul>
      <p>Images from your own archive are shown from memory on your device, never fetched from X.</p>

      <h2>Sounds you upload or record</h2>
      <p>Audio you record or upload stays in this tab and is gone when you close it. It is never sent anywhere.</p>

      <h2>Contact</h2>
      <p>Questions or concerns: open an issue on the project’s <a href={`${REPO}/issues`}>GitHub repository</a>.</p>
      <p className="fine-print">Last updated 2 November 2026. Source code: <a href={REPO}>{REPO.replace('https://', '')}</a>.</p>
    </section>
  </article>
}
