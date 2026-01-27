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
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body {
              font-family: Arial, sans-serif;
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
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            h1 { color: #4CAF50; margin-bottom: 20px; }
            p { color: #666; margin: 10px 0; }
            .success-icon { font-size: 60px; margin-bottom: 20px; }
            .close-btn {
              margin-top: 20px;
              padding: 10px 20px;
              background: #667eea;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 16px;
            }
            .close-btn:hover { background: #764ba2; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Authentication Successful!</h1>
            <p>RelanceWork is now connected to your Gmail account.</p>
            <p>You can close this window and return to your terminal.</p>
            <button class="close-btn" onclick="window.close()">Close Window</button>
          </div>
        </body>
      </html>
    `);

    console.log('✅ Gmail authentication successful!');
    console.log('💡 Next step: Setup Gmail watch with: POST /api/gmail/watch/setup');
  } catch (error: any) {
    console.error('Error in OAuth callback:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body {
              font-family: Arial, sans-serif;
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
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
            }
            h1 { color: #f44336; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Authentication Failed</h1>
            <p>${error.message}</p>
            <p>Please try again or check the console for more details.</p>
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
