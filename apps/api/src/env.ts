import * as dotenv from 'dotenv';
import * as path from 'path';

/** Load monorepo + local .env before modules read process.env. */
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();
