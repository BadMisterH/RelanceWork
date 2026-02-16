import "dotenv/config";
import app from "./app";
import { startAutoRelanceService } from "./services/autoRelanceService";
import { gmailMultiUserService } from "./services/gmailMultiUserService";

const PORT = process.env.PORT || 3000;

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);

  startAutoRelanceService();
  gmailMultiUserService.resumeActiveTracking();
});
