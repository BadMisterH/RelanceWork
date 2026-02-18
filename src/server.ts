import "dotenv/config";
import app from "./app";
import { startAutoRelanceService } from "./services/autoRelanceService";
import { gmailMultiUserService } from "./services/gmailMultiUserService";

const PORT = Number(process.env.PORT) || 3000;

console.log("ENV PORT =", process.env.PORT ?? "(not set, using 3000)");
console.log("NODE_ENV =", process.env.NODE_ENV ?? "(not set)");
console.log("GMAIL_REDIRECT_URI =", process.env.GMAIL_REDIRECT_URI ?? "(not set)");

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});
