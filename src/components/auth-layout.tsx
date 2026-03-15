import Image from "next/image";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Image
          src="/images/logo-shield.png"
          alt="Overwatch"
          width={64}
          height={64}
          priority
          className="rounded-xl"
          style={{ width: 64, height: "auto" }}
        />
        <h1 className="text-2xl font-bold tracking-tight font-mono uppercase">
          Overwatch
        </h1>
        <p className="text-sm text-muted-foreground">
          Workforce management for security teams
        </p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">
          Powered by Evenfall Advantage LLC
        </p>
      </div>
      {children}
    </div>
  );
}
