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
    <th className="border-b border-rule px-2 py-1 font-medium" {...props} />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td className="border-b border-rule px-2 py-1" {...props} />
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

        {/* The message list is a WELL (issue #68): it drops to `--card` while
            the header and the composer stay on the sheet's own `--popover`.
            Bubbles used to sit on that same `--popover` ground, 0.04 lightness
            from it, so an assistant bubble barely read as a separate object.
            Dropping the ground rather than raising the bubble is the ladder
            move #62 and #67 both make, and it needs no new token: measured as
            a luminance ratio (a WCAG ratio compresses to nothing this far down
            the scale), an assistant bubble goes from 1.68x its ground to
            2.98x. */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-card px-4 py-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aún no hay mensajes. Pregunta algo como &ldquo;¿cuál es la
              merma de este mes?&rdquo;
            </p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              // The user side keeps the orange but spends far less of it:
              // `bg-primary` solid made a long message the loudest surface in
              // the app, against #62's ration of the accent to `--primary`,
              // `--ring` and one headline number. At 20% over the well it is a
              // warm tint (3.49x the ground) that the opaque left rule marks
              // as the accent; the assistant side stays neutral at `--muted`.
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-lg rounded-l-sm border-l-2 border-primary bg-primary/20 px-3 py-2 text-sm text-foreground"
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
          className="flex items-center gap-2 border-t border-rule p-4"
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
