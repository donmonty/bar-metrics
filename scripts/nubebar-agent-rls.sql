-- nubebar_agent grants + Row-Level Security (issue #32, PRD #31, ADR 0002).
--
-- Run as the existing `db` role (table owner) against the live nubebar
-- Postgres on DigitalOcean, AFTER `nubebar_agent` has been created via DO's
-- managed-database API (`db-cluster-create-user`) — NOT by raw `CREATE ROLE`.
-- See README -> "nubebar_agent role + RLS" for the full one-time sequence.
--
-- Idempotent: every grant is naturally re-runnable, and every policy is
-- dropped (IF EXISTS) and recreated, so this script is the living source of
-- truth for "which tables currently have RLS" — re-run it whenever Django
-- introduces a new tenant-bearing table.
--
-- Session-variable contract (shared by every policy below):
--   SET app.sucursal_ids = '1,2,3'   -- comma-separated integers, plain string
-- Read via current_setting('app.sucursal_ids', true) — the `true` means
-- "don't error if unset"; unset/empty resolves to zero matching rows
-- (fail-closed), not an error or unrestricted access.
--
-- NOTE on table count: PRD #31 / issue #32 both label this "13 RLS-scoped
-- tables" in prose, but their own itemized direct/indirect lists name 8 + 6
-- = 14 distinct tables. This script implements the itemized list verbatim
-- (the more specific, safer source of truth) rather than truncating to match
-- the prose count — see the PR description for this discrepancy.

-- ---------------------------------------------------------------------------
-- Direct group: own sucursal_id (or id, for core_sucursal itself) column.
-- ---------------------------------------------------------------------------

ALTER TABLE core_sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_sucursal FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_sucursal;
CREATE POLICY nubebar_agent_sucursal_scope ON core_sucursal
  USING (id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[]));

ALTER TABLE core_almacen ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_almacen FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_almacen;
CREATE POLICY nubebar_agent_sucursal_scope ON core_almacen
  USING (sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[]));

-- core_botella.sucursal_id is nullable: a null sucursal_id is excluded (no
-- Sucursal claims it), not coalesced to a default — matches the existing
-- nubebar/index.ts convention of filtering out null almacen_id rows.
ALTER TABLE core_botella ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_botella FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_botella;
CREATE POLICY nubebar_agent_sucursal_scope ON core_botella
  USING (sucursal_id IS NOT NULL AND sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[]));

ALTER TABLE core_inspeccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_inspeccion FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_inspeccion;
CREATE POLICY nubebar_agent_sucursal_scope ON core_inspeccion
  USING (sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[]));

ALTER TABLE core_productosinregistro ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_productosinregistro FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_productosinregistro;
CREATE POLICY nubebar_agent_sucursal_scope ON core_productosinregistro
  USING (sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[]));

ALTER TABLE core_receta ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_receta FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_receta;
CREATE POLICY nubebar_agent_sucursal_scope ON core_receta
  USING (sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[]));

ALTER TABLE core_traspaso ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_traspaso FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_traspaso;
CREATE POLICY nubebar_agent_sucursal_scope ON core_traspaso
  USING (sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[]));

ALTER TABLE core_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_venta FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_venta;
CREATE POLICY nubebar_agent_sucursal_scope ON core_venta
  USING (sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[]));

-- ---------------------------------------------------------------------------
-- Indirect group: no own sucursal_id; EXISTS subquery walks the join path
-- back to a direct-group table's own policy expression.
-- ---------------------------------------------------------------------------

ALTER TABLE core_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_caja FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_caja;
CREATE POLICY nubebar_agent_sucursal_scope ON core_caja
  USING (EXISTS (
    SELECT 1 FROM core_almacen
    WHERE core_almacen.id = core_caja.almacen_id
      AND core_almacen.sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[])
  ));

ALTER TABLE core_iteminspeccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_iteminspeccion FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_iteminspeccion;
CREATE POLICY nubebar_agent_sucursal_scope ON core_iteminspeccion
  USING (EXISTS (
    SELECT 1 FROM core_inspeccion
    WHERE core_inspeccion.id = core_iteminspeccion.inspeccion_id
      AND core_inspeccion.sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[])
  ));

ALTER TABLE core_reportemermas ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_reportemermas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_reportemermas;
CREATE POLICY nubebar_agent_sucursal_scope ON core_reportemermas
  USING (EXISTS (
    SELECT 1 FROM core_inspeccion
    WHERE core_inspeccion.id = core_reportemermas.inspeccion_id
      AND core_inspeccion.sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[])
  ));

-- Joins directly to core_almacen (not via core_reportemermas) per PRD #31.
ALTER TABLE core_mermaingrediente ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_mermaingrediente FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_mermaingrediente;
CREATE POLICY nubebar_agent_sucursal_scope ON core_mermaingrediente
  USING (EXISTS (
    SELECT 1 FROM core_almacen
    WHERE core_almacen.id = core_mermaingrediente.almacen_id
      AND core_almacen.sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[])
  ));

ALTER TABLE core_ingredientereceta ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_ingredientereceta FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_ingredientereceta;
CREATE POLICY nubebar_agent_sucursal_scope ON core_ingredientereceta
  USING (EXISTS (
    SELECT 1 FROM core_receta
    WHERE core_receta.id = core_ingredientereceta.receta_id
      AND core_receta.sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[])
  ));

ALTER TABLE core_consumorecetavendida ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_consumorecetavendida FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nubebar_agent_sucursal_scope ON core_consumorecetavendida;
CREATE POLICY nubebar_agent_sucursal_scope ON core_consumorecetavendida
  USING (EXISTS (
    SELECT 1 FROM core_venta
    WHERE core_venta.id = core_consumorecetavendida.venta_id
      AND core_venta.sucursal_id = ANY(string_to_array(current_setting('app.sucursal_ids', true), ',')::int[])
  ));

-- ---------------------------------------------------------------------------
-- Grants: CONNECT + USAGE + SELECT-only. No write grants anywhere, ever —
-- a second independent barrier alongside RLS, not redundant with it.
-- Plain GRANT statements are themselves idempotent (re-granting is a no-op).
-- ---------------------------------------------------------------------------

GRANT CONNECT ON DATABASE db TO nubebar_agent;
GRANT USAGE ON SCHEMA public TO nubebar_agent;

-- RLS-scoped tables (14, per the itemized lists above).
GRANT SELECT ON
  core_sucursal,
  core_almacen,
  core_botella,
  core_inspeccion,
  core_productosinregistro,
  core_receta,
  core_traspaso,
  core_venta,
  core_caja,
  core_iteminspeccion,
  core_reportemermas,
  core_mermaingrediente,
  core_ingredientereceta,
  core_consumorecetavendida
TO nubebar_agent;

-- Catalog tables: plain SELECT, no RLS (no Sucursal dimension to restrict by).
GRANT SELECT ON
  core_categoria,
  core_ingrediente,
  core_producto,
  core_proveedor,
  core_cliente
TO nubebar_agent;

-- Django's own user/auth tables: NO grants at all (not even SELECT) — kept
-- entirely out of nubebar_agent's reach, per PRD #31's explicit exclusion.
-- (core_user, core_user_groups, core_user_sucursales,
-- core_user_user_permissions — intentionally absent from every GRANT above.)
