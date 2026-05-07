import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { prisma } from '../../lib/prisma.js';

export async function destroyStaffIdCardPublicId(publicId: string | null | undefined): Promise<void> {
  if (!publicId?.trim() || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId.trim(), { resource_type: 'image' });
  } catch (e) {
    console.warn('[staff-id-card] cloudinary destroy:', e);
  }
}

async function uploadStaffIdCardBuffer(params: {
  folder: string;
  buffer: Buffer;
  mimetype: string;
}): Promise<{ publicId: string; secureUrl: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error('cloudinary_not_configured');
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: params.folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      },
      (err, res) => {
        if (err) reject(err);
        else if (!res?.public_id || !res.secure_url) reject(new Error('cloudinary_upload_failed'));
        else resolve({ publicId: res.public_id, secureUrl: res.secure_url });
      }
    );
    stream.end(params.buffer);
  });
}

/** 팀장·마케터 계정 — 사원증 교체 */
export async function replaceStaffIdCardForUser(
  userId: string,
  buffer: Buffer,
  mimetype: string
): Promise<{ staffIdCardUrl: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { staffIdCardPublicId: true, role: true },
  });
  if (!user || (user.role !== 'TEAM_LEADER' && user.role !== 'MARKETER')) {
    throw new Error('user_not_found_or_invalid_role');
  }
  const folder = `skcleanteck/staff-id-cards/users/${userId}`;
  const uploaded = await uploadStaffIdCardBuffer({ folder, buffer, mimetype });
  const oldPid = user.staffIdCardPublicId;
  await prisma.user.update({
    where: { id: userId },
    data: { staffIdCardPublicId: uploaded.publicId, staffIdCardUrl: uploaded.secureUrl },
  });
  await destroyStaffIdCardPublicId(oldPid);
  return { staffIdCardUrl: uploaded.secureUrl };
}

export async function clearStaffIdCardForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { staffIdCardPublicId: true, role: true },
  });
  if (!user || (user.role !== 'TEAM_LEADER' && user.role !== 'MARKETER')) {
    throw new Error('user_not_found_or_invalid_role');
  }
  await destroyStaffIdCardPublicId(user.staffIdCardPublicId);
  await prisma.user.update({
    where: { id: userId },
    data: { staffIdCardPublicId: null, staffIdCardUrl: null },
  });
}

/** 현장 팀원(TeamMember) — 사원증 교체 */
export async function replaceStaffIdCardForTeamMember(
  memberId: string,
  buffer: Buffer,
  mimetype: string
): Promise<{ staffIdCardUrl: string }> {
  const m = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { staffIdCardPublicId: true },
  });
  if (!m) {
    throw new Error('team_member_not_found');
  }
  const folder = `skcleanteck/staff-id-cards/team-members/${memberId}`;
  const uploaded = await uploadStaffIdCardBuffer({ folder, buffer, mimetype });
  const oldPid = m.staffIdCardPublicId;
  await prisma.teamMember.update({
    where: { id: memberId },
    data: { staffIdCardPublicId: uploaded.publicId, staffIdCardUrl: uploaded.secureUrl },
  });
  await destroyStaffIdCardPublicId(oldPid);
  return { staffIdCardUrl: uploaded.secureUrl };
}

export async function clearStaffIdCardForTeamMember(memberId: string): Promise<void> {
  const m = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { staffIdCardPublicId: true },
  });
  if (!m) {
    throw new Error('team_member_not_found');
  }
  await destroyStaffIdCardPublicId(m.staffIdCardPublicId);
  await prisma.teamMember.update({
    where: { id: memberId },
    data: { staffIdCardPublicId: null, staffIdCardUrl: null },
  });
}

/** 팀원 삭제 전 Cloudinary 정리 */
export async function removeTeamMemberStaffIdCardAsset(memberId: string): Promise<void> {
  const m = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { staffIdCardPublicId: true },
  });
  await destroyStaffIdCardPublicId(m?.staffIdCardPublicId ?? null);
}
