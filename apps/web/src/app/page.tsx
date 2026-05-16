import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="flex max-w-sm flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-semibold">Hello world</h1>
        <p className="text-muted-foreground">
          A minimal Next.js app with the shadcn component setup preserved.
        </p>
        <Button>shadcn button</Button>
      </section>
    </main>
  );
}
