const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FULFILLMENT = new Set(["shipping", "local_pickup", "both"]);
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function text(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function money(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback;
}

export function normalizeFindInput(body = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || body.title !== undefined) out.title = text(body.title, 120);
  if (!partial || body.description !== undefined)
    out.description = text(body.description, 3000);
  if (!partial || body.price !== undefined) out.price = money(body.price, -1);
  if (!partial || body.condition !== undefined)
    out.condition = text(body.condition, 100);
  if (!partial || body.quantity !== undefined) {
    const q = Number(body.quantity);
    out.quantity = Number.isInteger(q) && q >= 0 && q <= 999 ? q : -1;
  }
  if (!partial || body.fulfillment !== undefined) {
    const f = text(body.fulfillment, 30).toLowerCase();
    out.fulfillment = FULFILLMENT.has(f) ? f : "";
  }
  if (!partial || body.shippingPrice !== undefined)
    out.shippingPrice = money(body.shippingPrice, -1);
  if (body.active !== undefined) out.active = body.active === true;
  return out;
}

function validateFind(item, { partial = false } = {}) {
  if ((!partial || item.title !== undefined) && !item.title)
    throw new Error("Enter an item name.");
  if ((!partial || item.price !== undefined) && item.price < 0)
    throw new Error("Enter a valid price.");
  if ((!partial || item.quantity !== undefined) && item.quantity < 0)
    throw new Error("Enter a valid quantity.");
  if ((!partial || item.fulfillment !== undefined) && !item.fulfillment)
    throw new Error("Choose shipping, local pickup, or both.");
  if ((!partial || item.shippingPrice !== undefined) && item.shippingPrice < 0)
    throw new Error("Enter a valid shipping price.");
}

function decodeImages(images, { required = false } = {}) {
  if (images === undefined && !required) return null;
  if (!Array.isArray(images) || (required && !images.length))
    throw new Error("Add at least one item photo.");
  if (images.length > MAX_IMAGES)
    throw new Error(`Add no more than ${MAX_IMAGES} photos.`);
  return images.map((image, index) => {
    const mimeType = text(image?.mimeType, 80).toLowerCase();
    if (!IMAGE_TYPES.has(mimeType))
      throw new Error("Photos must be JPG, PNG, or WebP.");
    const bytes = Buffer.from(String(image?.data || ""), "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
      throw new Error("Each photo must be 5 MB or smaller.");
    return {
      filename: text(image?.filename || `item-${index + 1}.jpg`, 160),
      mimeType,
      bytes,
      position: index,
    };
  });
}

async function ensureSchema(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS sole_rebel_finds (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(12,2) NOT NULL,
    condition_label TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    fulfillment TEXT NOT NULL DEFAULT 'shipping',
    shipping_price NUMERIC(12,2) NOT NULL DEFAULT 6,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sole_rebel_find_images (
    id BIGSERIAL PRIMARY KEY,
    find_id BIGINT NOT NULL REFERENCES sole_rebel_finds(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    image_bytes BYTEA NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_sole_rebel_find_images_find ON sole_rebel_find_images(find_id,position)",
  );
}

const selectFinds = (where = "") => `SELECT f.*,
  COALESCE((SELECT json_agg(json_build_object('id',i.id,'url','/api/finds/'||f.id||'/photos/'||i.id,'position',i.position) ORDER BY i.position) FROM sole_rebel_find_images i WHERE i.find_id=f.id),'[]'::json) AS images
  FROM sole_rebel_finds f ${where} ORDER BY f.created_at DESC`;

function present(row) {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    price: Number(row.price),
    condition: row.condition_label,
    quantity: Number(row.quantity),
    fulfillment: row.fulfillment,
    shippingPrice: Number(row.shipping_price),
    active: row.active,
    images: row.images || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function replaceImages(client, findId, images) {
  if (images === null) return;
  await client.query("DELETE FROM sole_rebel_find_images WHERE find_id=$1", [
    findId,
  ]);
  for (const image of images)
    await client.query(
      `INSERT INTO sole_rebel_find_images(find_id,filename,mime_type,image_bytes,position)
       VALUES($1,$2,$3,$4,$5)`,
      [findId, image.filename, image.mimeType, image.bytes, image.position],
    );
}

export function registerSoleRebelFindsRoutes(
  app,
  { pool, requireAdmin, getIds },
) {
  app.get("/api/finds", async (_req, res) => {
    try {
      await ensureSchema(pool);
      const { rows } = await pool.query(
        selectFinds("WHERE f.active=TRUE AND f.quantity>0"),
      );
      res.json({ items: rows.map(present) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/finds/:findId/photos/:imageId", async (req, res) => {
    try {
      await ensureSchema(pool);
      const { rows } = await pool.query(
        `SELECT filename,mime_type,image_bytes FROM sole_rebel_find_images
         WHERE id=$1 AND find_id=$2`,
        [req.params.imageId, req.params.findId],
      );
      const image = rows[0];
      if (!image) return res.sendStatus(404);
      res.type(image.mime_type);
      res.setHeader("Cache-Control", "public,max-age=300");
      res.send(image.image_bytes);
    } catch {
      res.sendStatus(404);
    }
  });

  app.get("/api/admin/finds", requireAdmin, async (_req, res) => {
    try {
      await ensureSchema(pool);
      const { rows } = await pool.query(selectFinds());
      res.json({ items: rows.map(present) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/finds", requireAdmin, async (req, res) => {
    let client;
    try {
      const item = normalizeFindInput(req.body);
      validateFind(item);
      const images = decodeImages(req.body?.images, { required: true });
      client = await pool.connect();
      await client.query("BEGIN");
      await ensureSchema(client);
      const { rows } = await client.query(
        `INSERT INTO sole_rebel_finds(title,description,price,condition_label,quantity,fulfillment,shipping_price,active)
         VALUES($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING id`,
        [
          item.title,
          item.description,
          item.price,
          item.condition,
          item.quantity,
          item.fulfillment,
          item.shippingPrice,
        ],
      );
      await replaceImages(client, rows[0].id, images);
      await client.query("COMMIT");
      res.status(201).json({ ok: true, id: String(rows[0].id) });
    } catch (e) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      res.status(400).json({ error: e.message });
    } finally {
      if (client) client.release();
    }
  });

  app.patch("/api/admin/finds/:id", requireAdmin, async (req, res) => {
    let client;
    try {
      const item = normalizeFindInput(req.body, { partial: true });
      validateFind(item, { partial: true });
      const images = decodeImages(req.body?.images);
      client = await pool.connect();
      await client.query("BEGIN");
      await ensureSchema(client);
      const current = await client.query(
        "SELECT * FROM sole_rebel_finds WHERE id=$1 FOR UPDATE",
        [req.params.id],
      );
      if (!current.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Listing not found." });
      }
      const row = current.rows[0];
      const next = {
        title: item.title ?? row.title,
        description: item.description ?? row.description,
        price: item.price ?? Number(row.price),
        condition: item.condition ?? row.condition_label,
        quantity: item.quantity ?? Number(row.quantity),
        fulfillment: item.fulfillment ?? row.fulfillment,
        shippingPrice: item.shippingPrice ?? Number(row.shipping_price),
        active: item.active ?? row.active,
      };
      const updated = await client.query(
        `UPDATE sole_rebel_finds SET title=$2,description=$3,price=$4,condition_label=$5,quantity=$6,fulfillment=$7,shipping_price=$8,active=$9,updated_at=NOW()
         WHERE id=$1 RETURNING id`,
        [
          req.params.id,
          next.title,
          next.description,
          next.price,
          next.condition,
          next.quantity,
          next.fulfillment,
          next.shippingPrice,
          next.active,
        ],
      );
      await replaceImages(client, req.params.id, images);
      await client.query("COMMIT");
      res.json({ ok: true, id: String(updated.rows[0].id) });
    } catch (e) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      res.status(400).json({ error: e.message });
    } finally {
      if (client) client.release();
    }
  });

  app.delete("/api/admin/finds/:id", requireAdmin, async (req, res) => {
    try {
      await ensureSchema(pool);
      const { rows } = await pool.query(
        "UPDATE sole_rebel_finds SET active=FALSE,updated_at=NOW() WHERE id=$1 RETURNING id",
        [req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: "Listing not found." });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/finds/:id/claim", async (req, res) => {
    let client;
    try {
      const customer = text(req.body?.customer, 120);
      const email = text(req.body?.email, 200);
      const phone = text(req.body?.phone, 80);
      const contact = text(req.body?.contact || phone || email, 200);
      const note = text(req.body?.note, 1000);
      const deliveryMethod = text(req.body?.deliveryMethod, 30).toLowerCase();
      const address =
        req.body?.address && typeof req.body.address === "object"
          ? req.body.address
          : {};
      if (!customer) throw new Error("Enter your name.");
      if (!contact) throw new Error("Enter an email address or phone number.");
      if (email && !/^\S+@\S+\.\S+$/.test(email))
        throw new Error("Enter a valid email address.");
      client = await pool.connect();
      await client.query("BEGIN");
      await ensureSchema(client);
      const itemResult = await client.query(
        "SELECT * FROM sole_rebel_finds WHERE id=$1 FOR UPDATE",
        [req.params.id],
      );
      const item = itemResult.rows[0];
      if (!item || !item.active || Number(item.quantity) < 1)
        throw new Error("This item is no longer available.");
      const allowed =
        item.fulfillment === "both"
          ? new Set(["shipping", "local_pickup"])
          : new Set([item.fulfillment]);
      if (!allowed.has(deliveryMethod))
        throw new Error("Choose an available delivery option.");
      if (
        deliveryMethod === "shipping" &&
        ![address.street, address.city, address.state, address.zip].every(
          (value) => text(value, 160),
        )
      )
        throw new Error("Enter a complete shipping address.");
      const { businessId, siteId } = await getIds(client);
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('sole-rebel-find-order-number'))",
      );
      const num = await client.query(
        `SELECT COALESCE(MAX((regexp_match(friendly_order_number,'^OF-([0-9]+)$'))[1]::int),1000)+1 AS next_number
         FROM orders WHERE business_id=$1 AND friendly_order_number ~ '^OF-[0-9]+$'`,
        [businessId],
      );
      const orderNumber = `OF-${num.rows[0].next_number}`;
      const subtotal = Number(item.price);
      const shipping =
        deliveryMethod === "shipping" ? Number(item.shipping_price) : 0;
      const total = subtotal + shipping;
      const metadata = {
        source: "sole-rebel-other-finds",
        orderType: "other_find",
        findId: String(item.id),
        itemTitle: item.title,
        itemDescription: item.description,
        itemCondition: item.condition_label,
        itemPrice: subtotal,
        customer,
        email,
        phone,
        contact,
        confirmationEmail: Boolean(email),
        confirmationText: Boolean(phone),
        confirmationPreferencesRecorded: true,
        deliveryMethod,
        shippingFlat: shipping,
        address: deliveryMethod === "shipping" ? address : {},
        specialRequest: note,
        paymentLinkClicked: false,
        paymentMethodClicked: null,
        paymentLinkClickedAt: null,
        paymentReported: false,
        trackingNumber: null,
        trackingCarrier: null,
        trackingUrl: null,
        trackingAddedAt: null,
      };
      const order = await client.query(
        `INSERT INTO orders (business_id,site_id,external_order_id,friendly_order_number,status,currency,subtotal,shipping,total,fulfillment_provider,fulfillment_status,ordered_at,metadata)
         VALUES($1,$2,$3,$3,'pending','USD',$4,$5,$6,'manual','awaiting payment',NOW(),$7::jsonb)
         RETURNING id,external_order_id,friendly_order_number,total,status,ordered_at`,
        [
          businessId,
          siteId,
          orderNumber,
          subtotal,
          shipping,
          total,
          JSON.stringify(metadata),
        ],
      );
      await client.query(
        "UPDATE sole_rebel_finds SET quantity=quantity-1,updated_at=NOW() WHERE id=$1",
        [item.id],
      );
      await client.query("COMMIT");
      res.status(201).json({ order: order.rows[0] });
    } catch (e) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      res.status(400).json({ error: e.message });
    } finally {
      if (client) client.release();
    }
  });
}
