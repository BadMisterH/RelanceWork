#!/usr/bin/env python3
"""
Script de conversion rapide d'un dump SQLite vers PostgreSQL (Supabase).
- Remplace les types de données principaux
- Commente les lignes SQLite non supportées
- Adapte l'autoincrement
"""
import re

input_file = 'data/relancework_export.sql'
output_file = 'data/relancework_export_pg.sql'

with open(input_file, 'r') as f:
    sql = f.read()

# Remplacements de types
sql = re.sub(r'INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY', sql)
sql = re.sub(r'INTEGER PRIMARY KEY', 'SERIAL PRIMARY KEY', sql)
sql = re.sub(r'TEXT', 'VARCHAR', sql)
sql = re.sub(r'DATETIME', 'TIMESTAMP', sql)
sql = re.sub(r'REAL', 'DOUBLE PRECISION', sql)
sql = re.sub(r'BLOB', 'BYTEA', sql)

# Supprimer ou commenter les commandes SQLite spécifiques
sql = re.sub(r'^PRAGMA.*$', '-- \g<0>', sql, flags=re.MULTILINE)
sql = re.sub(r'^BEGIN TRANSACTION;', '', sql, flags=re.MULTILINE)
sql = re.sub(r'^COMMIT;', '', sql, flags=re.MULTILINE)
sql = re.sub(r'^CREATE UNIQUE INDEX.*$', '-- \g<0>', sql, flags=re.MULTILINE)

# Optionnel: corriger les quotes pour les identifiants
sql = re.sub(r'"([^"]+)"', r'"\1"', sql)

with open(output_file, 'w') as f:
    f.write(sql)

print(f'Conversion terminée. Fichier généré : {output_file}')
