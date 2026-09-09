# Privacy

Monty Carlo Simulator is designed to be private by default. In plain terms:

**Your data never leaves your device.**

## What we collect

Nothing. There is no account, no sign-in, no analytics, no advertising, and no
third-party trackers. The app makes no network calls to anyone but its own
server, and only to run a simulation you asked for.

## What is stored, and where

Your settings, preferences, theme, and run history are saved in your **browser's
`localStorage`** (under the `mcs.` key prefix) on the device you're using. This
is what lets the app remember your inputs between visits. It stays in your
browser — it is never uploaded, synced, or shared.

- It does **not** move between your devices or browsers.
- It is visible only to you, in that browser.
- You can clear it any time with the **Reset** / clear controls in the app, or by
  clearing site data in your browser.

## Simulations and exports

Simulations run on the app's own serverless functions purely as **stateless
computation**: your inputs are sent, the result is computed and returned, and
**nothing is stored** on the server. Excel (`.xlsx`) and JSON exports are
generated on request and streamed back to your browser for download — they are
not retained.

We never ask for and never process real account numbers, balances tied to your
identity, Social Security numbers, or any other personal or financial
identifiers. All figures you enter are hypothetical planning inputs.

## No real financial data

The tool uses simplified, illustrative models. It does **not** connect to your
bank, brokerage, or any market-data provider. Nothing here is financial,
investment, tax, or legal advice.

## Hosting

The app is hosted on Vercel. As with any website, the hosting provider may
process standard, transient request metadata (such as IP address) to serve and
protect the site; the application itself neither logs nor persists this.

## Changes

If this ever changes — for example if privacy-respecting, cookieless analytics
are added — this document will be updated to say exactly what is collected and
why, before the change ships.
