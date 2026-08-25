// Trae el catálogo de productos de Zoho Books.
//
//   node scripts/zoho-productos.mjs            ver qué haría, sin escribir
//   node scripts/zoho-productos.mjs --aplicar  escribir de verdad
//
// Es la más barata de las pasadas: los productos vienen en el listado, no hay
// que abrir uno por uno. Nueve o diez consultas para todo el catálogo.

import { randomUUID } from "node:crypto";
import { conectar, entorno } from "./badger-cruce.mjs";

const APLICAR = process.argv.includes("--aplicar");

const env = entorno();
const sb = conectar(env);

const r0 = await fetch(`https://accounts.${env.ZOHO_DOMINIO ?? "zoho.com"}/oauth/v2/token`, {
  method: "POST",
  body: new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  }),
});
const d0 = await r0.json();
if (!d0.access_token) {
  console.error("\n  Zoho no dio token:", JSON.stringify(d0), "\n");
  process.exit(1);
}

const filas = [];
let pagina = 1;
let hay = true;

while (hay && pagina <= 40) {
  const u = new URL("https://www.zohoapis.com/books/v3/items");
  u.searchParams.set("organization_id", env.ZOHO_ORG_ID);
  u.searchParams.set("per_page", "200");
  u.searchParams.set("page", String(pagina));

  const r = await fetch(u, {
    headers: { Authorization: `Zoho-oauthtoken ${d0.access_token}` },
  });
  const d = await r.json();
  if (d.code && d.code !== 0) {
    console.error(`\n  Zoho respondió ${d.code}: ${d.message}\n`);
    process.exit(1);
  }
  filas.push(...(d.items ?? []));
  hay = d.page_context?.has_more_page ?? false;
  pagina += 1;
}

const momento = new Date().toISOString();

const productos = filas.map((i) => ({
  id: randomUUID(),
  item_id: i.item_id,
  nombre: (i.name ?? i.item_name ?? "Sin nombre").trim(),
  descripcion: (i.description ?? "").trim() || null,
  sku: (i.sku ?? "").trim() || null,
  unidad: (i.unit ?? "").trim() || null,
  // Cero en Books significa «se acuerda con el cliente», no «vale cero».
  precio: Number(i.rate ?? 0) > 0 ? Number(i.rate) : null,
  existencia: Number(
    i.available_for_sale ?? i.available_stock ?? i.stock_on_hand ?? 0,
  ),
  activo: i.status === "active",
  se_vende: i.can_be_sold !== false,
  sincronizado_en: momento,
}));

const vendibles = productos.filter((p) => p.activo && p.se_vende);
const conPrecio = vendibles.filter((p) => p.precio !== null).length;
const conStock = vendibles.filter((p) => p.existencia > 0).length;

console.log(`\n  ${productos.length} productos en Books`);
console.log(`  ${vendibles.length} activos y vendibles`);
console.log(`  ${conPrecio} con precio de lista · ${vendibles.length - conPrecio} a consultar`);
console.log(`  ${conStock} con existencia\n`);

if (!APLICAR) {
  console.log("  Nada se escribió. Para hacerlo:\n");
  console.log("    node scripts/zoho-productos.mjs --aplicar\n");
  process.exit(0);
}

for (let i = 0; i < productos.length; i += 200) {
  await sb("/productos_zoho?on_conflict=item_id", {
    method: "POST",
    body: JSON.stringify(productos.slice(i, i + 200)),
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

// Lo que ya no está en Books se marca como ido, no se borra: puede estar
// nombrado en una transacción vieja y perderlo dejaría el historial cojo.
const vivos = productos.map((p) => p.item_id);
const guardados = await sb("/productos_zoho?select=id,item_id&deleted_at=is.null");
const idos = guardados.filter((g) => !vivos.includes(g.item_id));

for (let i = 0; i < idos.length; i += 100) {
  const lote = idos.slice(i, i + 100).map((x) => x.id);
  await sb(`/productos_zoho?id=in.(${lote.join(",")})`, {
    method: "PATCH",
    body: JSON.stringify({ deleted_at: momento }),
    prefer: "return=minimal",
  });
}

console.log(`  ${productos.length} productos escritos.`);
if (idos.length) console.log(`  ${idos.length} ya no están en Books y se marcaron como idos.`);
console.log("\n  Listo.\n");
