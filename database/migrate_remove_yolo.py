import os
import sys
from dotenv import load_dotenv
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()
DB = os.getenv("DATABASE_URL")
if not DB:
    raise RuntimeError(".env dosyasinda DATABASE_URL bulunamadi!")

conn = psycopg2.connect(DB)
conn.autocommit = True
cur = conn.cursor()

cur.execute("ALTER TABLE analyses DROP COLUMN IF EXISTS detection_model")
print("[OK] detection_model kaldirildi")

cur.execute("ALTER TABLE analyses DROP COLUMN IF EXISTS detection_boxes")
print("[OK] detection_boxes kaldirildi")

cur.execute("ALTER TABLE analyses DROP COLUMN IF EXISTS lesion_location")
print("[OK] lesion_location kaldirildi")

default_val = "EfficientNet-B4"
cur.execute(
    "ALTER TABLE analyses ALTER COLUMN classification_model SET DEFAULT %s",
    (default_val,)
)
print("[OK] classification_model default = EfficientNet-B4 ayarlandi")

cur.execute("""
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'analyses' AND table_schema = 'public'
    ORDER BY ordinal_position
""")
cols = cur.fetchall()
print("\nanalyses tablosu (guncellenmis sutunlar):")
for c in cols:
    print(f"  {c[0]:<35} {c[1]:<20} default={c[2]}")

cur.close()
conn.close()
print("\nTamamlandi.")
