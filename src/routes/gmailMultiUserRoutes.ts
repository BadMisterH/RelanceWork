/**
 * Routes Gmail Multi-Utilisateur
 * Chaque user gère son propre compte Gmail
 */

import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { gmailMultiUserService } from '../services/gmailMultiUserService';

const router = express.Router();

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

    res.send(`
      <html>
        <head>
          <title>Gmail Connecté ✅</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 16px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            h1 { color: #4CAF50; margin-bottom: 20px; font-size: 28px; }
            p { color: #666; margin: 15px 0; font-size: 16px; }
            .success-icon { font-size: 80px; margin-bottom: 20px; }
            .close-btn {
              margin-top: 30px;
              padding: 12px 30px;
              background: #667eea;
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 500;
            }
            .close-btn:hover { background: #764ba2; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Gmail Connecté avec Succès !</h1>
            <p>RelanceWork va maintenant détecter automatiquement vos candidatures depuis votre Gmail.</p>
            <p><strong>Vous pouvez fermer cette fenêtre et retourner à l'application.</strong></p>
            <button class="close-btn" onclick="window.close()">Fermer</button>
          </div>
        </body>
      </html>
    `);

    console.log(`✅ Gmail connected successfully for user ${userId}`);
  } catch (error: any) {
    console.error('Error in OAuth callback:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Erreur de Connexion</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f44336;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 16px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
            }
            h1 { color: #f44336; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Échec de la Connexion</h1>
            <p>${error.message}</p>
            <p>Veuillez réessayer ou consulter les logs du serveur.</p>
          </div>
        </body>
      </html>
    `);
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
