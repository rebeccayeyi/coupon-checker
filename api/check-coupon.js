export default async function handler(req, res) {
  // 1️⃣ Allow cross-origin requests
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow all origins
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // 2️⃣ Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const coupon = req.query.coupon;

  if (!coupon) {
    return res.status(400).json({
      status: "error",
      message: "Missing coupon",
    });
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN;
  const BASE_ID = process.env.AIRTABLE_BASE;
  const TABLE = process.env.AIRTABLE_TABLE;

  if (!AIRTABLE_API_KEY || !BASE_ID || !TABLE) {
    return res.status(500).json({
      status: "error",
      message: "Server configuration error",
    });
  }

  const formula = `{Promo Code Static}='${coupon.replace(/'/g, "\\'")}'`;
  console.log({ formula });

  // 1️⃣ Find coupon
  const findUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(
    TABLE
  )}?filterByFormula=${encodeURIComponent(formula)}`;
  console.log({ findUrl });

  const findRes = await fetch(findUrl, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    },
  });

  if (!findRes.ok) {
    const errText = await findRes.text();
    return res.status(500).json({
      status: "error",
      message: "Airtable lookup failed",
      details: errText,
    });
  }

  const data = await findRes.json();
  const record = data.records?.[0];

  if (!record) {
    return res.status(200).json({ status: "invalid" });
  }

  // 2️⃣ Already redeemed?
  if (record.fields.Redeemed === true) {
    return res.status(200).json({ status: "redeemed" });
  }

  // 3️⃣ Mark redeemed
  const updateUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(
    TABLE
  )}/${record.id}`;

  const updateRes = await fetch(updateUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        Redeemed: true,
        "Redeemed At": new Date().toISOString(),
      },
    }),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    return res.status(500).json({
      status: "error",
      message: "Failed to mark coupon as redeemed",
      details: errText,
    });
  }

  return res.status(200).json({ status: "success" });
}
