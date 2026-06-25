# Nubebar — Domain Glossary

The ubiquitous language for the nubebar bar-inventory domain — a *shared kernel*
between the legacy Django API (write side) and this bar-metrics app (read side).
Terms are drawn from the Django model
(`api-nubebar-django/app/core/models.py`) and refined as this dashboard +
chatbot project is designed. This is the canonical glossary and lives here; the
Django repo points to it. Glossary only — no implementation details.

## Organizational entities

- **Cliente** — The legal entity (person or company) that operates one or more
  bars. The top of the ownership hierarchy.
- **Sucursal** — A single bar / consumption venue ("centro de consumo"). A
  Cliente operates one or many Sucursales. The unit a bar manager thinks in.
- **Almacén** — A storage location inside a Sucursal where bottles live. Two
  types: **Barra** (the bar itself) and **Bodega** (the stockroom).
- **Caja** — A point-of-sale register, always tied to an Almacén. Sales are
  recorded through a Caja.
- **User** — A dashboard/app user, scoped to one or more Sucursales (email-based
  auth in the Django app).

## Product / catalog entities

- **Categoría** — A class of spirit (WHISKY, TEQUILA, VODKA, …).
- **Ingrediente** — A specific distillate/spirit that goes into recipes. Belongs
  to a Categoría. Has a `factor_peso` (density factor to convert grams ↔ mL).
- **Receta** — A menu item (cocktail, shot, or bottle) sold at a Sucursal.
  Composed of one or more Ingredientes via **IngredienteReceta**, each with a
  `volumen` (mL of that ingredient the recipe should pour).
- **Producto** — A bottle *type*: a unique combination of ingredient, container
  size, and unit price. The template; not a physical object.

## Physical inventory entities

- **Botella** — A single *physical* bottle with a unique `folio` (SAT tax-stamp
  ID). Tracked by weight: `peso_inicial`, `peso_actual`, plus glass/full
  reference weights. States: NUEVA, CON_LIQUIDO, VACÍA, PERDIDA.
- **Traspaso** — A transfer of a Botella from one Almacén to another.
- **Stock value** — The current total monetary value of all active Botellas on
  hand at a Sucursal, computed from each Botella's remaining liquid and its
  Producto's unit price. A point-in-time snapshot, not a time series — no
  historical stock-value snapshots exist in the data model.

## Measurement & sales events

- **Venta** — A sale of a Receta at a Sucursal through a Caja, on a date, with
  units and amount (importe). Sourced from POS exports.
- **ConsumoRecetaVendida** — The ingredient consumption *implied* by a Venta:
  selling a Receta implies pouring its ingredients' volumes. This is the
  **theoretical / expected** consumption.
- **Inspección** — A stock-taking event over an Almacén in which bottles are
  weighed. Types: DIARIA, TOTAL. States: ABIERTA, CERRADA. Composed of
  **ItemInspección** (the weighing of one physical Botella).

## The signature metric

- **Merma** — Variance/shrinkage. For an Ingrediente over a period:
  `merma = consumo_ventas − consumo_real`, i.e. theoretical consumption (from
  sales) minus measured real consumption (from weighing bottles across
  Inspecciones). A high merma % flags over-pouring, theft, spillage, or
  unregistered sales. **This is the core insight the dashboard and chatbot
  exist to surface.**
  - **consumo_ventas** — Theoretical consumption implied by Ventas.
  - **consumo_real** — Actual consumption measured by weight differences.
  - **ReporteMermas / MermaIngrediente** — A computed merma report for an
    Inspección, broken down per Ingrediente.
- **ProductoSinRegistro** — A POS sales line for an item not registered in the
  catalog — i.e. sales the system can't attribute to a Receta. A data-quality /
  leakage signal.
