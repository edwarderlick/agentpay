import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <p className="font-mono text-xs uppercase tracking-widest text-secondary">404</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-primary">Page not found</h1>
      <p className="mt-3 text-[#424843]">That route is not part of the AgentPay frontend.</p>
      <Link href="/" className="mt-6 inline-flex bg-primary px-5 py-3 font-bold text-white">
        Back to landing
      </Link>
    </div>
  );
}
