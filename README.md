# FileVerse

FileVerse is a secure cloud-based document management system featuring real-time collaboration, AES-256-GCM file encryption at rest, granular access permissions, version control, and audit logging.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Database setup**:
   Configure your PostgreSQL connection string (`DATABASE_URL`) in the `.env` file and push the schema:
   ```bash
   npx prisma db push
   ```

3. **Run servers**:
   Start the Next.js development server:
   ```bash
   npm run dev
   ```
   Start the WebSocket collaboration server in a separate terminal:
   ```bash
   npm run ws
   ```

Open [http://localhost:3000](http://localhost:3000) in your browser to access the application.
