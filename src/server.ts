import app from "./app";
import db from "./config/database";

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);

  // Tester la connexion DB
  try {
    db.prepare("SELECT 1").get();
    console.log("✅ Database connected");
    console.log(`📁 Database location: ${db.name}`);
  } catch (err) {
    console.error("❌ Database connection error:", (err as Error).message);
  }
});
