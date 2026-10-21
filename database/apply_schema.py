"""
MammoXai - NeonDB schema uygulayici
DATABASE_URL .env dosyasindan okunur.
"""
import os
import sys
from dotenv import load_dotenv
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(".env dosyasinda DATABASE_URL bulunamadi!")

schema_path = os.path.join(os.path.dirname(__file__), "database", "schema.sql")

with open(schema_path, "r", encoding="utf-8") as f:
    schema_sql = f.read()

print("NeonDB'ye baglaniliyor...")
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

print("Sema uygulanıyor...")
cur.execute(schema_sql)

print("Tablolar kontrol ediliyor...")
cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
""")
tables = cur.fetchall()
print("\nOlusturulan tablolar:")
for t in tables:
    print(f"  [OK] {t[0]}")

cur.close()
conn.close()
print("\nSema basariyla uygulandi!")
