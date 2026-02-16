import "dotenv/config";
import app from "./app";
import { startAutoRelanceService } from "./services/autoRelanceService";
import { gmailMultiUserService } from "./services/gmailMultiUserService";

const PORT = Number(process.env.PORT) || 3000;

console.log("ENV PORT =", process.env.PORT ?? "(not set, using 3000)");

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});
