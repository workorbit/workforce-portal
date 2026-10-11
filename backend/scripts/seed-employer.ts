/**
 * One-time bootstrap: creates the very first Employer/Admin account. There
 * is no public signup for this role (doc §8, assumption 1) — an employer
 * always creates employee accounts, but the first employer has to come from
 * somewhere. Run once, then log in and start creating employees.
 *
 * Usage:
 *   npm run seed:employer -- --name "Jane Doe" --email jane@company.com --password Str0ngPassword!
 */
import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import * as bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { User, UserSchema } from '../apps/auth/src/apis/auth/auth.schema';
import { UserRole } from '../libs/shared/src/interfaces/user-role.enum';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const name = readArg('--name') ?? process.env.SEED_EMPLOYER_NAME;
  const email = readArg('--email') ?? process.env.SEED_EMPLOYER_EMAIL;
  const password = readArg('--password') ?? process.env.SEED_EMPLOYER_PASSWORD;

  if (!name || !email || !password) {
    console.error(
      'Usage: npm run seed:employer -- --name "Sudarsan" --email sudarsan.neelam@gmail.com --password sudarsan.neelam',
    );
    process.exit(1);
  }

  const uri = process.env.APP_MONGODB_URI;
  if (!uri) {
    console.error('APP_MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const UserModel = mongoose.model(User.name, UserSchema);

  const existing = await UserModel.findOne({ email });
  if (existing) {
    console.log(`An account for ${email} already exists (role: ${existing.role}). Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  // An Employer/Admin's companyId is its own id — generate the id up front
  // so both fields can be set in one insert.
  const _id = new Types.ObjectId();
  const passwordHash = await bcrypt.hash(password, 10);
  await UserModel.create({
    _id,
    name,
    email,
    passwordHash,
    role: UserRole.EMPLOYER_ADMIN,
    companyId: _id.toString(),
  });

  console.log(`Employer account created for ${email}.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Failed to seed employer:', error);
  process.exit(1);
});
