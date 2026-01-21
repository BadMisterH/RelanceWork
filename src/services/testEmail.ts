import { sendRelanceReminder } from "../services/emailServices";
import dotenv from "dotenv";
dotenv.config();

const testApplications = [
  { company: "Google", poste: "Développeur", date: "15/01/2026" },
  { company: "Microsoft", poste: "DevOps", date: "14/01/2026" },
];

sendRelanceReminder(testApplications).then((success) => {
  console.log(success ? "✅ Test réussi" : "❌ Test échoué");
  process.exit(0);
}); 