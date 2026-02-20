import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { authenticateToken } from "../middleware/authMiddleware";
import { subscriptionService } from "../services/subscriptionService";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

/**
 * GET /api/billing/status
 * Retourne le plan actuel de l'utilisateur
 */
router.get("/status", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const plan = await subscriptionService.getUserPlan(userId);
    const appLimits = await subscriptionService.checkLimit(userId, "applications");
    const searchLimits = await subscriptionService.checkLimit(userId, "searches");

    res.json({
      ...plan,
      limits: {
        applications: appLimits,
        searches: searchLimits,
      },
    });
  } catch (error: any) {
    console.error("Error getting billing status:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/billing/create-checkout
 * Crée une session Stripe Checkout pour passer à Pro
 */
router.post("/create-checkout", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const url = await subscriptionService.createCheckoutSession(
      user.id,
      user.email
    );

    res.json({ url });
  } catch (error: any) {
    console.error("Error creating checkout:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/billing/portal
 * Crée un lien vers le portail client Stripe
 */
router.post("/portal", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const url = await subscriptionService.createPortalSession(userId);

    res.json({ url });
  } catch (error: any) {
    console.error("Error creating portal:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/billing/webhook
 * Reçoit les événements Stripe (pas d'auth JWT - vérifié par signature Stripe)
 */
router.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (webhookSecret && sig) {
      // Vérification de la signature en production
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } else {
      // Mode test sans webhook secret — parse le Buffer brut en JSON
      const bodyStr = Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : JSON.stringify(req.body);
      event = JSON.parse(bodyStr) as Stripe.Event;
    }

    await subscriptionService.handleWebhook(event);

    res.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    res.status(400).json({ error: error.message });
  }
});

export default router;
