import { CLONE_DEMO_TAG, DUMMY_PHOTO_PUBLIC_ID, DUMMY_PHOTO_URL } from './constants.js';

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'] as const;

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pad3(n: number): string {
  return String(n % 1000).padStart(3, '0');
}

export class Anonymizer {
  private readonly customerNames = new Map<string, string>();
  private readonly externalNames = new Map<string, string>();
  private readonly teamMemberNames = new Map<string, string>();
  private readonly teamNames = new Map<string, string>();
  private readonly userNames = new Map<string, string>();

  demoCustomerName(sourceKey: string): string {
    const cached = this.customerNames.get(sourceKey);
    if (cached) return cached;
    const h = hash32(`cust:${sourceKey}`);
    const name = `${SURNAMES[h % SURNAMES.length]}데모${pad3(h)}`;
    this.customerNames.set(sourceKey, name);
    return name;
  }

  demoExternalCompanyName(sourceKey: string): string {
    const cached = this.externalNames.get(sourceKey);
    if (cached) return cached;
    const h = hash32(`ext:${sourceKey}`);
    const name = `데모협력사${String.fromCharCode(65 + (h % 26))}${pad3(h)}`;
    this.externalNames.set(sourceKey, name);
    return name;
  }

  demoTeamMemberName(sourceKey: string): string {
    const cached = this.teamMemberNames.get(sourceKey);
    if (cached) return cached;
    const h = hash32(`tm:${sourceKey}`);
    const name = `팀원${pad3(h)}`;
    this.teamMemberNames.set(sourceKey, name);
    return name;
  }

  demoTeamName(sourceKey: string): string {
    const cached = this.teamNames.get(sourceKey);
    if (cached) return cached;
    const h = hash32(`team:${sourceKey}`);
    const name = `데모팀${pad3(h)}`;
    this.teamNames.set(sourceKey, name);
    return name;
  }

  demoStaffUserName(sourceKey: string, role: string): string {
    const cached = this.userNames.get(sourceKey);
    if (cached) return cached;
    const h = hash32(`user:${sourceKey}`);
    const prefix =
      role === 'MARKETER' ? '마케터' : role === 'TEAM_LEADER' ? '팀장' : role === 'ADMIN' ? '관리자' : '스태프';
    const name = `${prefix}${pad3(h)}`;
    this.userNames.set(sourceKey, name);
    return name;
  }

  demoPhone(sourceKey: string): string {
    const h = hash32(`phone:${sourceKey}`);
    return `010-0000-${String(h % 10000).padStart(4, '0')}`;
  }

  demoEmail(sourceKey: string): string {
    const h = hash32(`email:${sourceKey}`);
    return `demo+${h}@example.cbiseo.local`;
  }

  demoAddress(sourceKey: string): string {
    const h = hash32(`addr:${sourceKey}`);
    const districts = ['강남구', '서초구', '마포구', '송파구', '영등포구', '수원시', '성남시', '고양시'];
    return `서울특별시 ${districts[h % districts.length]} 데모로 ${(h % 90) + 1}`;
  }

  demoAddressDetail(): string {
    return '데모동 101호';
  }

  scrubText(text: string | null | undefined): string | null {
    if (!text?.trim()) return text ?? null;
    let out = text;
    out = out.replace(/01[016789]-?\d{3,4}-?\d{4}/g, '010-0000-0000');
    out = out.replace(/[\w.-]+@[\w.-]+\.\w+/g, 'demo@example.cbiseo.local');
    if (!out.includes(CLONE_DEMO_TAG)) {
      out = `${CLONE_DEMO_TAG} ${out}`;
    }
    return out;
  }

  dummyPhoto(seed: string): { url: string; publicId: string } {
    const h = hash32(`photo:${seed}`) % 5;
    return {
      url: `${DUMMY_PHOTO_URL}?v=${h}`,
      publicId: `${DUMMY_PHOTO_PUBLIC_ID}_${h}`,
    };
  }

  remapInquiryNumber(sourceNumber: string | null | undefined, newId: string): string | null {
    if (!sourceNumber?.trim()) return null;
    const h = hash32(`inqnum:${newId}`);
    const digits = sourceNumber.replace(/\D/g, '');
    const tail = digits.slice(-8) || String(h % 100000000).padStart(8, '0');
    return `cb${tail.slice(0, 10)}`;
  }

  newToken(prefix: string, sourceId: string): string {
    const h = hash32(`${prefix}:${sourceId}`).toString(36);
    return `${prefix}_${h}_${sourceId.slice(0, 8)}`;
  }
}
