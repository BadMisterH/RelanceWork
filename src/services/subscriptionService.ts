import Stripe from "stripe";
import { supabase } from "../config/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

export type Plan = "free" | "pro";

interface SubscriptionInfo {
  plan: Plan;
  status: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
}

const FREE_LIMITS = {
  max_applications: 10,
  max_searches_per_month: 15,
};

export class SubscriptionService {
  /**
   * Retourne le plan actuel d'un utilisateur
   */
  async getUserPlan(userId: string): Promise<SubscriptionInfo> {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!data) {
      return {
        plan: "free",
        status: "active",
        stripe_customer_id: null,
        current_period_end: null,
      };
    }

    return {
      plan: data.plan as Plan,
      status: data.status,
      stripe_customer_id: data.stripe_customer_id,
      current_period_end: data.current_period_end,
    };
  }

  /**
   * Crée une session Stripe Checkout pour passer à Pro
   */
  async createCheckoutSession(
    userId: string,
    userEmail: string
  ): Promise<string> {
    // Chercher ou créer le customer Stripe
    let customerId = await this.getOrCreateCustomer(userId, userEmail);

    // Récupérer le Price ID depuis Stripe (le premier prix actif du produit)
    const priceId = await this.getProPriceId();

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: "http://localhost:5173/?upgrade=success",
      cancel_url: "http://localhost:5173/?upgrade=cancel",
      metadata: { user_id: userId },
    });

    return session.url!;
  }

  /**
   * Crée un lien vers le portail client Stripe (gérer abonnement)
   */
  async createPortalSession(userId: string): Promise<string> {
    const { data } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (!data?.stripe_customer_id) {
      throw new Error("Pas d'abonnement actif");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: "http://localhost:5173/",
    });

    return session.url;
  }

  /**
   * Gère les webhooks Stripe
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        if (!userId) break;

        // Récupérer les détails de la subscription
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        await this.upsertSubscription(userId, {
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          plan: "pro",
          status: "active",
          current_period_end: new Date(
            (subscription as any).current_period_end * 1000
          ).toISOString(),
        });

        console.log(`💳 User ${userId} upgraded to Pro!`);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;

        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          const customerId = invoice.customer as string;

          // Trouver l'utilisateur par customer_id
          const { data } = await supabase
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (data) {
            await supabase
              .from("subscriptions")
              .update({
                status: "active",
                current_period_end: new Date(
                  (subscription as any).current_period_end * 1000
                ).toISOString(),
              })
              .eq("user_id", data.user_id);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (data) {
          await supabase
            .from("subscriptions")
            .update({ plan: "free", status: "canceled" })
            .eq("user_id", data.user_id);

          console.log(`📉 User ${data.user_id} downgraded to Free`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_customer_id", customerId);
        break;
      }
    }
  }

  /**
   * Vérifie si l'utilisateur peut effectuer une action (limites du plan free)
   */
  async checkLimit(
    userId: string,
    limitType: "applications" | "searches"
  ): Promise<{ allowed: boolean; current: number; max: number }> {
    const { plan } = await this.getUserPlan(userId);

    if (plan === "pro") {
      return { allowed: true, current: 0, max: Infinity };
    }

    if (limitType === "applications") {
      const { count } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      const current = count || 0;
      return {
        allowed: current < FREE_LIMITS.max_applications,
        current,
        max: FREE_LIMITS.max_applications,
      };
    }

    if (limitType === "searches") {
      return this.checkSearchLimit(userId);
    }

    return { allowed: true, current: 0, max: Infinity };
  }

  /**
   * Vérifie la limite de recherches pour le mois courant
   */
  async checkSearchLimit(
    userId: string
  ): Promise<{ allowed: boolean; current: number; max: number }> {
    const { plan } = await this.getUserPlan(userId);

    if (plan === "pro") {
      return { allowed: true, current: 0, max: Infinity };
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // "2026-02"

    const { data } = await supabase
      .from("search_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("month", currentMonth)
      .single();

    const current = data?.count || 0;
    return {
      allowed: current < FREE_LIMITS.max_searches_per_month,
      current,
      max: FREE_LIMITS.max_searches_per_month,
    };
  }

  /**
   * Incrémente le compteur de recherches pour le mois courant
   */
  async incrementSearchCount(
    userId: string
  ): Promise<{ current: number; max: number }> {
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Try to update existing row
    const { data: existing } = await supabase
      .from("search_usage")
      .select("id, count")
      .eq("user_id", userId)
      .eq("month", currentMonth)
      .single();

    let newCount: number;

    if (existing) {
      newCount = (existing.count || 0) + 1;
      await supabase
        .from("search_usage")
        .update({ count: newCount })
        .eq("id", existing.id);
    } else {
      newCount = 1;
      await supabase.from("search_usage").insert({
        user_id: userId,
        month: currentMonth,
        count: 1,
      });
    }

    const { plan } = await this.getUserPlan(userId);
    const max =
      plan === "pro" ? Infinity : FREE_LIMITS.max_searches_per_month;

    return { current: newCount, max };
  }

  // --- Private helpers ---

  private async getOrCreateCustomer(
    userId: string,
    email: string
  ): Promise<string> {
    // Vérifier si on a déjà un customer
    const { data } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (data?.stripe_customer_id) {
      return data.stripe_customer_id;
    }

    // Créer un nouveau customer Stripe
    const customer = await stripe.customers.create({
      email,
      metadata: { user_id: userId },
    });

    // Sauvegarder en base
    await this.upsertSubscription(userId, {
      stripe_customer_id: customer.id,
      plan: "free",
      status: "active",
    });

    return customer.id;
  }

  private async upsertSubscription(
    userId: string,
    data: Record<string, any>
  ): Promise<void> {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (existing) {
      await supabase
        .from("subscriptions")
        .update(data)
        .eq("user_id", userId);
    } else {
      await supabase.from("subscriptions").insert({
        user_id: userId,
        ...data,
      });
    }
  }

  /**
   * Récupère le Price ID du plan Pro depuis Stripe
   */
  private async getProPriceId(): Promise<string> {
    // Chercher le premier prix actif
    const prices = await stripe.prices.list({
      active: true,
      type: "recurring",
      limit: 1,
    });

    if (prices.data.length === 0) {
      throw new Error(
        "Aucun prix trouvé dans Stripe. Créez un produit + prix dans le dashboard Stripe."
      );
    }

    return prices.data[0]!.id;
  }
}

export const subscriptionService = new SubscriptionService();
