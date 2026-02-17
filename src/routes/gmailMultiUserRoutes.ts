/**
 * Routes Gmail Multi-Utilisateur
 * Chaque user gère son propre compte Gmail
 */

import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { gmailMultiUserService } from '../services/gmailMultiUserService';

const router = express.Router();

function renderGmailCallbackPage(options: {
  title: string;
  headline: string;
  message: string;
  variant: 'success' | 'error';
  actionLabel?: string;
  actionHref?: string;
}) {
  const { title, headline, message, variant, actionLabel, actionHref } = options;
  const accent = variant === 'success' ? '#10b981' : '#ef4444';
  const button = actionLabel
    ? `<a class="btn" href="${actionHref || '/app'}">${actionLabel}</a>`
    : '';

  return `
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
        <style>
          :root {
            color-scheme: light;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at top, rgba(37,99,235,0.35), rgba(15,23,42,1) 45%), #0b1020;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: #e2e8f0;
            padding: 24px;
          }
          .card {
            width: min(520px, 100%);
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 20px;
            padding: 40px 36px;
            box-shadow: 0 30px 60px rgba(15, 23, 42, 0.45);
            text-align: center;
          }
          .logo {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            font-family: 'Archivo', sans-serif;
            font-weight: 800;
            letter-spacing: 0.4px;
            margin-bottom: 24px;
          }
          .logo-badge {
            width: 44px;
            height: 44px;
            border-radius: 14px;
            background: #2563eb;
            color: white;
            display: grid;
            place-items: center;
            font-size: 22px;
            font-weight: 800;
          }
          h1 {
            font-family: 'Archivo', sans-serif;
            font-size: 24px;
            margin: 0 0 12px;
            color: ${accent};
          }
          p {
            margin: 0;
            color: #cbd5f5;
            line-height: 1.6;
            font-size: 15px;
          }
          .status {
            margin: 24px auto 18px;
            width: 64px;
            height: 64px;
            border-radius: 20px;
            display: grid;
            place-items: center;
            background: rgba(37, 99, 235, 0.15);
            border: 1px solid rgba(148, 163, 184, 0.2);
            font-size: 34px;
          }
          .btn {
            margin-top: 28px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 12px 24px;
            border-radius: 12px;
            background: #2563eb;
            color: #fff;
            text-decoration: none;
            font-weight: 600;
            box-shadow: 0 10px 20px rgba(37, 99, 235, 0.25);
            transition: transform 0.2s ease, background 0.2s ease;
          }
          .btn:hover { background: #1d4ed8; transform: translateY(-1px); }
          .note { margin-top: 16px; font-size: 13px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">
            <div class="logo-badge">R</div>
            RelanceWork
          </div>
          <div class="status">${variant === 'success' ? '✅' : '⚠️'}</div>
          <h1>${headline}</h1>
          <p>${message}</p>
          ${button}
          <div class="note">Vous pouvez fermer cette fenêtre ou retourner à l'application.</div>
        </div>
      </body>
    </html>
  `;
}

/**
 * GET /api/gmail-user/status
 * Vérifie si l'utilisateur a connecté son Gmail
 */
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const isConnected = await gmailMultiUserService.isGmailConnected(userId);
    const gmailEmail = isConnected ? await gmailMultiUserService.getGmailEmail(userId) : null;

    res.json({
      connected: isConnected,
      gmail_email: gmailEmail,
      message: isConnected
        ? `Gmail connecté: ${gmailEmail}`
        : 'Connectez votre compte Gmail pour auto-détecter vos candidatures'
    });
  } catch (error: any) {
    console.error('Error checking Gmail status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/gmail-user/connect
 * Génère l'URL pour connecter Gmail (OAuth)
 */
router.get('/connect', authenticateToken, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.id;
    const userEmail = user.email;

    const authUrl = gmailMultiUserService.getAuthUrl(userId, userEmail);

    res.json({
      auth_url: authUrl,
      message: `Ouvrez cette URL pour autoriser l'accès à ${userEmail}`
    });
  } catch (error: any) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/gmail-user/callback
 * Callback OAuth - échange le code contre un token
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).send('Missing authorization code');
    }

    if (!state || typeof state !== 'string') {
      return res.status(400).send('Missing user ID');
    }

    const userId = state; // state contient le userId

    await gmailMultiUserService.handleOAuthCallback(code, userId);

    res.send(
      renderGmailCallbackPage({
        title: 'Gmail connecté - RelanceWork',
        headline: 'Gmail connecté avec succès',
        message:
          'RelanceWork va maintenant détecter automatiquement vos candidatures depuis votre Gmail.',
        variant: 'success',
        actionLabel: "Retourner à l'application",
        actionHref: '/app'
      })
    );

    console.log(`✅ Gmail connected successfully for user ${userId}`);
  } catch (error: any) {
    console.error('Error in OAuth callback:', error);
    res.status(500).send(
      renderGmailCallbackPage({
        title: 'Connexion Gmail échouée - RelanceWork',
        headline: 'Connexion Gmail échouée',
        message: `${error.message}. Veuillez réessayer ou contacter le support.`,
        variant: 'error',
        actionLabel: "Retourner à l'application",
        actionHref: '/app'
      })
    );
  }
});

/**
 * POST /api/gmail-user/check-emails
 * Vérifie manuellement les nouveaux emails
 */
router.post('/check-emails', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const isConnected = await gmailMultiUserService.isGmailConnected(userId);

    if (!isConnected) {
      return res.status(400).json({
        error: 'Gmail non connecté',
        message: 'Connectez d\'abord votre compte Gmail avec GET /api/gmail-user/connect'
      });
    }

    await gmailMultiUserService.checkEmailsForUser(userId);

    res.json({
      success: true,
      message: 'Emails vérifiés avec succès. Les nouvelles candidatures ont été ajoutées.'
    });
  } catch (error: any) {
    console.error('Error checking emails:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gmail-user/tracking/start
 * Démarre le suivi - seuls les emails envoyés APRÈS cet instant seront détectés
 */
router.post('/tracking/start', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const isConnected = await gmailMultiUserService.isGmailConnected(userId);
    if (!isConnected) {
      return res.status(400).json({ error: 'Gmail non connecté' });
    }

    const startedAt = await gmailMultiUserService.startTracking(userId);

    res.json({
      success: true,
      tracking: true,
      started_at: startedAt,
      message: 'Suivi activé. Seuls les emails envoyés à partir de maintenant seront détectés.'
    });
  } catch (error: any) {
    console.error('Error starting tracking:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gmail-user/tracking/stop
 * Arrête le suivi
 */
router.post('/tracking/stop', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    await gmailMultiUserService.stopTracking(userId);

    res.json({
      success: true,
      tracking: false,
      message: 'Suivi arrêté.'
    });
  } catch (error: any) {
    console.error('Error stopping tracking:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/gmail-user/tracking/status
 * Statut du suivi
 */
router.get('/tracking/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const status = await gmailMultiUserService.getTrackingStatus(userId);

    res.json(status);
  } catch (error: any) {
    console.error('Error getting tracking status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gmail-user/send-email
 * Envoie un email via Gmail API (vrai suivi de relance)
 */
router.post('/send-email', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Champs requis: to, subject, body' });
    }

    const isConnected = await gmailMultiUserService.isGmailConnected(userId);
    if (!isConnected) {
      return res.status(400).json({
        error: 'Gmail non connecté',
        gmail_not_connected: true,
        message: 'Connectez votre compte Gmail pour envoyer des emails directement.'
      });
    }

    const result = await gmailMultiUserService.sendEmail(userId, to, subject, body);

    res.json({
      success: true,
      messageId: result.messageId,
      message: 'Email envoyé avec succès via Gmail'
    });
  } catch (error: any) {
    console.error('Error sending email via Gmail:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gmail-user/disconnect
 * Déconnecte Gmail
 */
router.post('/disconnect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    await gmailMultiUserService.disconnectGmail(userId);

    res.json({
      success: true,
      message: 'Gmail déconnecté avec succès'
    });
  } catch (error: any) {
    console.error('Error disconnecting Gmail:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
