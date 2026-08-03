import Stripe from "npm:stripe@17.7.0";
import { stripeSecretKey } from "./config.ts";

let singleton: Stripe | undefined;

export const getStripe = (): Stripe => {
  singleton ??= new Stripe(stripeSecretKey(), {
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: { name: "Lumipost.ai", version: "1.0.0" },
  });
  return singleton;
};

export const stripeLiveMode = () => stripeSecretKey().startsWith("sk_live_");

export const stripeSubscriptionStatus = (
  status: Stripe.Subscription.Status,
) => {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled") return "canceled";
  return "pending";
};
