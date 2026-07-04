// Privacy, Terms and Security — honest plain language for a client-side product.
import React from 'react';
import { Card } from '../ui/components';
import { TopNav } from './Landing';

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-2xl mx-auto px-5 py-12">
        <h1 className="font-display text-2xl text-mist-50 mb-6">{title}</h1>
        <Card className="p-7 space-y-5 text-sm text-mist-300 leading-relaxed [&_h2]:font-display [&_h2]:text-mist-50 [&_h2]:text-base [&_h2]:mt-2">
          {children}
        </Card>
      </div>
    </div>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy">
      <h2>The short version</h2>
      <p>Your data files are analysed inside your browser. We never receive your raw rows. What stays on your device is encrypted. You can erase everything in one click.</p>
      <h2>What we process and where</h2>
      <p>Uploaded files (Excel, CSV, PDF, JSON, code) and pasted links are parsed locally, in your browser tab. Tables, dashboards and chat history are stored on your device in encrypted form (AES-256-GCM, key kept on your device).</p>
      <h2>What can leave your device</h2>
      <p>Only two things, both optional: (1) sign-in details handled by Supabase (Google or phone OTP) so your plan can follow you; (2) compact numeric summaries — totals, top categories, column names — sent to our AI endpoint <i>only</i> when you switch on cloud consent in Settings and your plan includes cloud AI. Raw rows are never sent. Payments are processed entirely by Razorpay.</p>
      <h2>Your rights</h2>
      <p>Export your workspaces as encrypted backups anytime. "Erase all local data" in Settings deletes every byte Insight stored on the device. To delete your sign-in account, email us and we remove it within 7 days.</p>
      <h2>No trackers</h2>
      <p>No analytics scripts, no ad pixels, no fingerprinting.</p>
      <p className="text-xs text-mist-500">Contact: smyttenorders@smytten.com</p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms of use">
      <h2>The service</h2>
      <p>Kithra Insight turns files you provide into dashboards and answers. It is an analysis aid — verify important numbers before acting on them. Forecasts are estimates from past data, not promises.</p>
      <h2>Your data, your responsibility</h2>
      <p>Only upload data you are allowed to use. Because analysis happens on your device, you remain the controller of that data.</p>
      <h2>Plans & payments</h2>
      <p>Paid plans are billed via Razorpay (cards, UPI, netbanking, wallets), monthly or yearly. Cancel anytime — you keep the plan until the period ends, then return to Free. If the product is broken for you and we cannot fix it within a week, we refund the current period.</p>
      <h2>Fair use</h2>
      <p>Daily AI-question limits exist to keep the service healthy. Automated scraping or resale of the AI endpoints is not allowed.</p>
      <h2>Liability</h2>
      <p>The service is provided as-is. To the maximum extent permitted by law, our liability is limited to the amount you paid in the last 12 months.</p>
      <p className="text-xs text-mist-500">Contact: smyttenorders@smytten.com</p>
    </Page>
  );
}

export function SecurityPage() {
  return (
    <Page title="Security">
      <h2>Architecture</h2>
      <p>Insight is a client-side application: parsing, profiling, querying and charting run in your browser. There is no server holding your datasets.</p>
      <h2>Encryption</h2>
      <p>Workspaces are stored in your browser's IndexedDB, sealed with AES-256-GCM using a random 256-bit key generated on your device. Portable backups are protected with your passphrase via PBKDF2 (250,000 iterations, SHA-256) + AES-256-GCM.</p>
      <h2>Transport & auth</h2>
      <p>Everything is served over HTTPS (GitHub Pages). Sign-in uses Supabase (Google OAuth / phone OTP); access rules are enforced server-side with row-level security. The public API key in the app is anonymous by design — it grants nothing without your session.</p>
      <h2>Payments</h2>
      <p>Card/UPI details go directly to Razorpay's PCI-DSS-compliant checkout. They never pass through our code.</p>
      <h2>Honest limitations</h2>
      <p>Device-level encryption protects data at rest, but cannot protect against malware running on your own device or someone with full access to your unlocked browser profile. Use your device's lock screen and keep backups of important workspaces.</p>
      <p className="text-xs text-mist-500">Found a vulnerability? Email smyttenorders@smytten.com — we respond within 48 hours.</p>
    </Page>
  );
}
