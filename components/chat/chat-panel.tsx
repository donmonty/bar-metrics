/**
 * Chat Milestone A, Slice 3 (issue #44) — the collapsible chat side panel.
 * Mounted once by `app/dashboard/layout.tsx` so the `useChat` hook's message
 * state survives client-side navigation between `/dashboard/*` sub-pages
 * (PRD #41 Decision 2) and clears on tab close (no persistence).
 *
 * Mirrors `date-range-control.tsx` / `sucursal-switcher.tsx` for reading the
 * dashboard's active context from URL search params, then forwards it as
 * `useChat`'s `body` so the API route can default tool calls to the view the
 * user is currently looking at. The route re-validates `sucursalId` against
 * the session server-side (ADR 0002) — this is only a hint.
 */
"use client";

import { useState, type ComponentPropsWithoutRef } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "ai/react";
import { Loader2Icon, MessageCircleIcon, SendIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { resolveDateRange, resolveSucursalId } from "@/lib/dashboard/filters";
import type { SucursalSummary } from "@/lib/db/nubebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Minimal table/list styling — no Tailwind typography plugin in this repo. */
const markdownComponents = {
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <table className="my-1 w-full border-collapse text-left" {...props} />
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th className="border-b px-2 py-1 font-medium" {...props} />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td className="border-b px-2 py-1" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="list-disc space-y-1 pl-5" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="list-decimal space-y-1 pl-5" {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="[&:not(:first-child)]:mt-2" {...props} />
  ),
};

export function ChatPanel({
  sucursales,
}: {
  sucursales: SucursalSummary[];
}) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();

  const sucursalId = resolveSucursalId(
    sucursales.map((s) => s.id),
    searchParams.get("sucursal") ?? undefined,
  );
  const dateRange = resolveDateRange({
    range: searchParams.get("range") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
      body: {
        sucursalId: sucursalId ?? undefined,
        dateRange: { from: dateRange.from, to: dateRange.to },
      },
    });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm">
            <MessageCircleIcon />
            Chat
          </Button>
        }
      />
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Asistente de datos</SheetTitle>
          <SheetDescription>
            Pregunta sobre merma, ventas, stock o productos sin registro.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aún no hay mensajes. Pregunta algo como &ldquo;¿cuál es la
              merma de este mes?&rdquo;
            </p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
              }
            >
              {message.role === "user" ? (
                message.content
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Pensando...
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t p-4"
        >
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Escribe tu pregunta..."
            disabled={isLoading}
            aria-label="Mensaje"
          />
          <Button type="submit" size="icon-sm" disabled={isLoading || !input.trim()}>
            <SendIcon />
            <span className="sr-only">Enviar</span>
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
