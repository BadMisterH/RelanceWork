import "dotenv/config";
import app from "./app";
import { startAutoRelanceService } from "./services/autoRelanceService";
import { gmailMultiUserService } from "./services/gmailMultiUserService";

const PORT = Number(process.env.PORT);

console.log("ENV PORT =", process.env.PORT);

if (!PORT) {
  throw new Error("PORT not defined");
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});
