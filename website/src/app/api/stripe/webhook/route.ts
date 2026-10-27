import type Stripe from "stripe";
import { stripeConfig } from "@/lib/config";
import { stripe, syncSubscription } from "@/lib/stripe";

// Events to enable on the Stripe webhook endpoint.
const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

/** Stripe → database. Only signed events are accepted; the body must be read raw for the signature. */
export async function POST(request: Request) {
  if (!stripeConfig?.webhookSecret) return Response.json({ error: "not_configured" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "missing_signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await request.text(), signature, stripeConfig.webhookSecret);
  } catch {
    return Response.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    if (SUBSCRIPTION_EVENTS.has(event.type)) {
      await syncSubscription((event.data.object as Stripe.Subscription).id);
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        await syncSubscription(typeof session.subscription === "string" ? session.subscription : session.subscription.id);
      }
    }
  } catch (e) {
    console.error(`stripe webhook ${event.type} ${event.id}:`, e);
    return Response.json({ error: "sync_failed" }, { status: 500 }); // Stripe retries
  }
  return Response.json({ received: true });
}
