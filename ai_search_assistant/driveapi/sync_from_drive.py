import os
import io
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# === CONFIG ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_FOLDER = os.path.abspath(os.path.join(SCRIPT_DIR, '..', 'data', 'sample_docs'))  # Correct path

SERVICE_ACCOUNT_FILE = os.path.join(SCRIPT_DIR, 'service_account.json')
FOLDER_ID = '1QL4ZqZg1_E6GJSi2EPRq41BWXew1URKZ'

# Create local folder if it doesn't exist
os.makedirs(LOCAL_FOLDER, exist_ok=True)

# === SETUP ===
if not os.path.exists(SERVICE_ACCOUNT_FILE):
    raise FileNotFoundError(f"❌ Service account file not found at: {SERVICE_ACCOUNT_FILE}")

creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE,
    scopes=['https://www.googleapis.com/auth/drive']
)
service = build('drive', 'v3', credentials=creds)

# === FETCH FILES ===
results = service.files().list(
    q=f"'{FOLDER_ID}' in parents and trashed = false",
    fields="files(id, name, mimeType)"
).execute()

files = results.get('files', [])
print(f'📁 Found {len(files)} files in Google Drive folder.')

# === DOWNLOAD / EXPORT ===
for file in files:
    file_id = file['id']
    file_name = file['name']
    mime_type = file['mimeType']

    print(f"\n📄 Processing: {file_name} ({mime_type})")

    # Handle Google Docs export
    if mime_type == 'application/vnd.google-apps.document':
        request = service.files().export_media(fileId=file_id, mimeType='application/pdf')
        if not file_name.lower().endswith('.pdf'):
            file_name += '.pdf'
    else:
        request = service.files().get_media(fileId=file_id)

    file_path = os.path.join(LOCAL_FOLDER, file_name)

    # Skip if already exists
    if os.path.exists(file_path):
        print(f"⏩ Skipped (already exists): {file_name}")
        continue

    # Download/export
    with io.FileIO(file_path, 'wb') as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
    print(f"✅ Saved to: {file_path}")
