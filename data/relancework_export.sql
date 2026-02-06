PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        poste TEXT NOT NULL,
        status TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      , relanced INTEGER DEFAULT 0, email TEXT, userEmail TEXT, relance_count INTEGER DEFAULT 0, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE);
INSERT INTO applications VALUES(26,'Keyweo | VIE Barcelone','Développeur Web (PHP/MySQL/JavaScript)','Candidature envoyée','18/01/2026','2026-01-18 14:49:34',1,'jobs@keyweo.com',NULL,3,NULL);
INSERT INTO applications VALUES(33,'Systèmes de Caisses Enregistreuses','Alternant Technicien Informatique','Candidature envoyée','26/01/2026','2026-01-26 09:10:23',1,'contact@deltaprosolutions.fr','badraitoufel5@gmail.com',1,NULL);
INSERT INTO applications VALUES(35,'Realyze','Alternance Développeur Web Full Stack','Candidature envoyée','26/01/2026','2026-01-26 18:06:19',1,'contact@realyze.fr','badrrevision@gmail.com',1,NULL);
INSERT INTO applications VALUES(45,'Wealthcome','Fullstack Developer','Candidature envoyée','28/01/2026','2026-01-28 15:12:06',1,'contact@wealthcome.fr','badraitoufel5@gmail.com',1,NULL);
CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        last_login TEXT
      );
INSERT INTO users VALUES(1,'KHAZZANI','badrrevision@gmail.com','$2b$10$dyCmn.X414zrHteCIiGiJe345Xm1f8OGutlwL/4dsvGnSQrf952xC','2026-02-04 11:25:09','2026-02-04 11:25:34');
INSERT INTO sqlite_sequence VALUES('applications',47);
INSERT INTO sqlite_sequence VALUES('users',1);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_applications_user_id ON applications(user_id);
COMMIT;
