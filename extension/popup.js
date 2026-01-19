// Popup script pour RelanceWork Extension

document.addEventListener('DOMContentLoaded', () => {
  checkAPIStatus();
});

// Vérifier si l'API est accessible
async function checkAPIStatus() {
  const statusDiv = document.getElementById('status');

  try {
    const response = await fetch('http://localhost:3000/health');

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'ok') {
        statusDiv.className = 'status';
        statusDiv.innerHTML = `
          <strong>✅ Extension active</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Vos emails de candidature sont surveillés</p>
        `;
      } else {
        throw new Error('API non disponible');
      }
    } else {
      throw new Error('API non disponible');
    }
  } catch (error) {
    statusDiv.className = 'status inactive';
    statusDiv.innerHTML = `
      <strong>⚠️ API non disponible</strong>
      <p style="margin: 5px 0 0 0; font-size: 12px;">Assurez-vous que RelanceWork est démarré (npm run dev)</p>
    `;
  }
}
