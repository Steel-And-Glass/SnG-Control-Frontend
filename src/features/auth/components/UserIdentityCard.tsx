"use client";

import type { CurrentUser } from "@/features/auth/types/auth";

// Shows only the person's name and email. The Google Subject is an internal authentication identifier and is never rendered.
export function UserIdentityCard({ user }: { user: CurrentUser }) {
  return (
    <section aria-labelledby="identity-title" className="panel">
      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-teal-700" />
        <h2 id="identity-title" className="section-title">Sesión iniciada</h2>
      </div>
      <dl className="form-grid">
        <div><dt className="metadata">Nombre</dt><dd className="break-words font-medium">{user.name ?? "No disponible"}</dd></div>
        <div><dt className="metadata">Correo</dt><dd className="break-words font-medium">{user.email ?? "No disponible"}</dd></div>
      </dl>
    </section>
  );
}
