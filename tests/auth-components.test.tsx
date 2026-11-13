import { roleContext } from "./roleFixtures";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/features/auth/context/AuthProvider";
import { AuthGate } from "@/features/auth/components/AuthGate";
import { UserIdentityCard } from "@/features/auth/components/UserIdentityCard";
import LoginPage from "@/app/login/page";
import { user, testApiClient } from "./fixtures";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/features/auth/components/GoogleSignInButton", () => ({
  GoogleSignInButton: () => <button>Acceso Google</button>,
}));

const context = { status: "unauthenticated" as const, user: null, error: null, signIn: vi.fn(), logout: vi.fn(), invalidateSession: vi.fn(), ...roleContext(), apiClient: testApiClient };

describe("AuthGate", () => {
  it("shows loading without revealing protected content", () => {
    render(<AuthContext.Provider value={{ ...context, status: "loading" }}><AuthGate>Contenido privado</AuthGate></AuthContext.Provider>);
    expect(screen.getByRole("status")).toHaveTextContent("Validando sesión");
    expect(screen.queryByText("Contenido privado")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
  it("redirects unauthenticated users to login", () => {
    render(<AuthContext.Provider value={context}><AuthGate>Contenido privado</AuthGate></AuthContext.Provider>);
    expect(replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("Contenido privado")).not.toBeInTheDocument();
  });
  it("renders authenticated children", () => {
    render(<AuthContext.Provider value={{ ...context, status: "authenticated", ...roleContext("CommercialAdvisor"), user }}><AuthGate>Contenido privado</AuthGate></AuthContext.Provider>);
    expect(screen.getByText("Contenido privado")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("UserIdentityCard", () => {
  it("shows name and email without the Google Subject", () => {
    render(<UserIdentityCard user={user} />);
    expect(screen.getByText(user.email!)).toBeInTheDocument();
    expect(screen.getByText(user.name!)).toBeInTheDocument();
    expect(screen.queryByText(user.subject)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copiar/ })).not.toBeInTheDocument();
  });
  it("supports nullable name and email", () => {
    render(<UserIdentityCard user={{ ...user, name: null, email: null }} />);
    expect(screen.getAllByText("No disponible")).toHaveLength(2);
  });
});

describe("LoginPage", () => {
  it("shows Google sign-in and accessible session errors", () => {
    render(<AuthContext.Provider value={{ ...context, error: "No pudimos validar tu sesión." }}><LoginPage /></AuthContext.Provider>);
    expect(screen.getByRole("heading", { name: "SnG Control" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acceso Google" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos validar");
  });
  it("redirects authenticated users home", () => {
    render(<AuthContext.Provider value={{ ...context, status: "authenticated", ...roleContext("CommercialAdvisor"), user }}><LoginPage /></AuthContext.Provider>);
    expect(replace).toHaveBeenCalledWith("/");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
