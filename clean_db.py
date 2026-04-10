import sqlite3

conn = sqlite3.connect('leads.db')
cursor = conn.cursor()
cursor.execute("DELETE FROM leads WHERE length(price) > 11 OR price = '0' OR price = '' OR price = 'Unknown' OR length(location) < 3 OR location = 'Unknown'")
conn.commit()
print("Database cleaned up successfully.")
conn.close()
