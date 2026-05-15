"use client";

import { useEffect, useState } from "react";
import { getRole, setRole, type Role } from "@/lib/auth";

export function RoleSwitcher() {
  const [role, setRoleState] = useState<Role>("tech");

  useEffect(() => {
    setRoleState(getRole());
  }, []);

  function handleClick(): void {
    const next: Role = role === "tech" ? "manager" : "tech";
    setRole(next);
    setRoleState(next);
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-caption px-3 py-1.5 rounded-pill border border-border
        hover:bg-parchment active:scale-[0.95] transition-all min-h-[44px]
        flex items-center gap-2"
      aria-label={role === "tech" ? "Switch to manager view" : "Switch to tech view"}
    >
      <span className="text-muted">
        {role === "tech" ? "tech-jane" : "manager-paul"}
      </span>
      <span className="text-action font-medium">
        {role === "tech" ? "Switch to Manager" : "Switch to Tech"}
      </span>
    </button>
  );
}
