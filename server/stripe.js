import Stripe from "stripe";

let stripeClient = null;
let stripeClientKey = "";

function secretKey() {
  return process.env.STRIPE_SECRET_KEY || "";
}

export function isStripeConfigured() {
  return Boolean(secretKey());
}

export function getStripe() {
  const key = secretKey();
  if (!key) {
    return null;
  }
  if (!stripeClient || stripeClientKey !== key) {
    stripeClient = new Stripe(key);
    stripeClientKey = key;
  }
  return stripeClient;
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

async function lineItemForDish(stripe, line) {
  const menuItemId = String(line.menuItemId);
  try {
    const found = await stripe.products.search({
      query: `active:'true' AND metadata['menuItemId']:'${menuItemId}'`,
      limit: 1,
      expand: ["data.default_price"],
    });
    const price = found.data?.[0]?.default_price;
    if (
      price &&
      typeof price === "object" &&
      price.unit_amount === line.price &&
      price.currency === "usd"
    ) {
      return { quantity: line.qty, price: price.id };
    }
  } catch {
    /* use the menu price when the catalog price is missing or different */
  }

  return {
    quantity: line.qty,
    price_data: {
      currency: "usd",
      unit_amount: line.price,
      product_data: {
        name: line.name,
        metadata: { menuItemId },
      },
    },
  };
}

async function buildCheckoutLineItems(stripe, lines, taxCents) {
  const items = [];
  for (const line of lines) {
    items.push(await lineItemForDish(stripe, line));
  }
  if (taxCents > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: taxCents,
        product_data: { name: "Tax" },
      },
    });
  }
  return items;
}

/**
 * Create a Stripe Checkout session for an order or unpaid bill (amounts in cents).
 * flow "order" pays before the kitchen sees the order. flow "bill" pays a served tab.
 */
export async function createBillCheckoutSession({
  billId,
  orderId,
  lines,
  taxCents = 0,
  totalCents,
  flow = "bill",
  customerEmail,
  successUrl,
  cancelUrl,
}) {
  const stripe = getStripe();
  if (!stripe) {
    return { error: "Stripe is not configured" };
  }

  try {
    const lineItems =
      Array.isArray(lines) && lines.length > 0
        ? await buildCheckoutLineItems(stripe, lines, taxCents)
        : [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: totalCents,
                product_data: {
                  name: "Restaurant bill",
                  description: `Order ${orderId}`,
                },
              },
            },
          ];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail || undefined,
      line_items: lineItems,
      metadata: {
        billId: String(billId),
        orderId: String(orderId),
        flow,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return { session };
  } catch (err) {
    return { error: err.message || "Failed to create checkout session" };
  }
}

export function constructStripeEvent(rawBody, signature) {
  const stripe = getStripe();
  const whSecret = getStripeWebhookSecret();
  if (!stripe || !whSecret) {
    return { error: "Stripe webhook is not configured" };
  }
  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, whSecret);
    return { event };
  } catch (err) {
    return { error: err.message || "Invalid webhook signature" };
  }
}
