import bcrypt from 'bcryptjs';

/** User.passwordHash 비교 ??null(SNS-only ???�면 false */
export async function compareUserPasswordHash(
  passwordHash: string | null | undefined,
  plainPassword: string,
): Promise<boolean> {
  if (!passwordHash) return false;
  const plain = plainPassword.trim();
  if (!plain) return false;
  return bcrypt.compare(plain, passwordHash);
}
