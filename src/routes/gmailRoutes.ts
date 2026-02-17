import express, { Request, Response } from 'express';
import { gmailAuthService } from '../services/gmailAuthService';
import { gmailWatchService } from '../services/gmailWatchService';
import { gmailPollingService } from '../services/gmailPollingService';
import { addApplication } from '../controllers/applicationController';

const router = express.Router();

/**
 * GET /api/gmail/auth/status
 * Vérifie si Gmail est authentifié
 */
router.get('/auth/status', (req: Request, res: Response) => {
  const isAuthenticated = gmailAuthService.isAuthenticated();
  res.json({
    authenticated: isAuthenticated,
    message: isAuthenticated
      ? 'Gmail is authenticated and ready'
      : 'Gmail authentication required'
  });
});

/**
 * POST /api/gmail/auth/configure
 * Configure les credentials OAuth (pour setup automatique)
 */
router.post('/auth/configure', (req: Request, res: Response) => {
  try {
    const { client_id, client_secret, redirect_uri } = req.body;

    if (!client_id || !client_secret || !redirect_uri) {
      return res.status(400).json({
        error: 'Missing required fields: client_id, client_secret, redirect_uri'
      });
    }

    gmailAuthService.setCredentials({ client_id, client_secret, redirect_uri });

    res.json({
      success: true,
      message: 'Gmail credentials configured successfully'
    });
  } catch (error: any) {
    console.error('Error configuring Gmail credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/gmail/auth/url
 * Génère l'URL d'authentification OAuth
 */
router.get('/auth/url', (req: Request, res: Response) => {
  try {
    const authUrl = gmailAuthService.getAuthUrl();
    res.json({ authUrl });
  } catch (error: any) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/gmail/auth/callback
 * Callback OAuth - échange le code contre un token
 */
router.get('/auth/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).send('Missing authorization code');
    }

    await gmailAuthService.getTokenFromCode(code);

    res.send(`
      <html lang="fr">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Gmail connecté - RelanceWork</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
          <style>
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
              color: #10b981;
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
            <div class="status">✅</div>
            <h1>Gmail connecté avec succès</h1>
            <p>RelanceWork est maintenant connecté à votre Gmail.</p>
            <p>Vous pouvez fermer cette fenêtre ou retourner à l'application.</p>
            <a class="btn" href="/app">Retourner à l'application</a>
            <div class="note">Si la fenêtre ne se ferme pas automatiquement, vous pouvez la fermer manuellement.</div>
          </div>
        </body>
      </html>
    `);

    console.log('✅ Gmail authentication successful!');
    console.log('💡 Next step: Setup Gmail watch with: POST /api/gmail/watch/setup');
  } catch (error: any) {
    console.error('Error in OAuth callback:', error);
    res.status(500).send(`
      <html lang="fr">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Connexion Gmail échouée - RelanceWork</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: radial-gradient(circle at top, rgba(239,68,68,0.25), rgba(15,23,42,1) 45%), #0b1020;
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
              color: #ef4444;
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
              background: rgba(239, 68, 68, 0.15);
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
            <div class="status">⚠️</div>
            <h1>Connexion Gmail échouée</h1>
            <p>${error.message}</p>
            <p>Veuillez réessayer ou contacter le support.</p>
            <a class="btn" href="/app">Retourner à l'application</a>
            <div class="note">Si le problème persiste, vérifiez la configuration Gmail OAuth.</div>
          </div>
        </body>
      </html>
    `);
  }
});

/**
 * POST /api/gmail/watch/setup
 * Configure la surveillance Gmail avec Push Notifications
 */
router.post('/watch/setup', async (req: Request, res: Response) => {
  try {
    const { topicName } = req.body;

    if (!topicName) {
      return res.status(400).json({
        error: 'Missing topicName. Format: projects/YOUR_PROJECT_ID/topics/gmail-notifications'
      });
    }

    const result = await gmailWatchService.setupWatch(topicName);

    res.json({
      success: true,
      message: 'Gmail watch setup successfully',
      data: result
    });
  } catch (error: any) {
    console.error('Error setting up Gmail watch:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gmail/watch/stop
 * Arrête la surveillance Gmail
 */
router.post('/watch/stop', async (req: Request, res: Response) => {
  try {
    await gmailWatchService.stopWatch();
    res.json({
      success: true,
      message: 'Gmail watch stopped successfully'
    });
  } catch (error: any) {
    console.error('Error stopping Gmail watch:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gmail/webhook
 * Webhook pour recevoir les notifications Gmail Pub/Sub
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    console.log('📬 Received Gmail notification');

    // Vérifier si c'est un message Pub/Sub valide
    const message = req.body.message;
    if (!message || !message.data) {
      console.log('⚠️  Invalid Pub/Sub message format');
      return res.status(400).json({ error: 'Invalid message format' });
    }

    // Décoder les données Pub/Sub
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    console.log('📧 Notification data:', data);

    // Gmail envoie l'historyId et l'emailAddress
    const { historyId, emailAddress } = data;

    if (historyId) {
      console.log(`🔍 Processing history from ID: ${historyId}`);

      // Récupérer les messages récents dans le dossier SENT
      const recentEmails = await gmailWatchService.listRecentSentEmails(5);

      // Traiter chaque email
      for (const email of recentEmails) {
        const emailData = await gmailWatchService.processEmail(email.id);

        if (emailData) {
          // Ajouter à la base de données
          console.log('💾 Adding application to database:', emailData);
          await addApplication(emailData);
          console.log('✅ Application added successfully');
        }
      }
    }

    // Répondre rapidement à Pub/Sub (important!)
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);
    // Toujours répondre 200 à Pub/Sub même en cas d'erreur
    res.status(200).json({ error: error.message });
  }
});

/**
 * GET /api/gmail/test/recent
 * Test: Liste les derniers emails envoyés
 */
router.get('/test/recent', async (req: Request, res: Response) => {
  try {
    const maxResults = parseInt(req.query.max as string) || 10;
    const emails = await gmailWatchService.listRecentSentEmails(maxResults);

    // Récupérer les détails de chaque email
    const emailDetails = await Promise.all(
      emails.map(async (email) => {
        const message = await gmailWatchService.getMessage(email.id);
        const info = gmailWatchService.extractEmailInfo(message);
        return {
          id: email.id,
          ...info
        };
      })
    );

    res.json({
      count: emailDetails.length,
      emails: emailDetails
    });
  } catch (error: any) {
    console.error('Error listing recent emails:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gmail/test/process
 * Test: Traite un email spécifique par son ID
 */
router.post('/test/process', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: 'Missing messageId' });
    }

    const emailData = await gmailWatchService.processEmail(messageId);

    if (emailData) {
      // Ajouter à la base de données
      await addApplication(emailData);

      res.json({
        success: true,
        message: 'Application added successfully',
        data: emailData
      });
    } else {
      res.json({
        success: false,
        message: 'Email format not recognized or not a job application'
      });
    }
  } catch (error: any) {
    console.error('Error processing email:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/gmail/polling/status
 * Vérifier le statut du polling automatique
 */
router.get('/polling/status', (req: Request, res: Response) => {
  const status = gmailPollingService.getStatus();
  res.json(status);
});

/**
 * POST /api/gmail/polling/start
 * Démarrer le polling automatique
 */
router.post('/polling/start', (req: Request, res: Response) => {
  try {
    gmailPollingService.start();
    res.json({
      success: true,
      message: 'Gmail polling started successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gmail/polling/stop
 * Arrêter le polling automatique
 */
router.post('/polling/stop', (req: Request, res: Response) => {
  try {
    gmailPollingService.stop();
    res.json({
      success: true,
      message: 'Gmail polling stopped successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
