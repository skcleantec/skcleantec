import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  brandTemplateCategory,
  brandTemplateCopyMeta,
  buildBrandTemplateVariant,
  emphasizeTypeLabel,
  readBrandExtra,
  templateTokens,
  type BrandTemplateSource,
} from './alimtalkBrandTemplateVariant.js';

const orderLink = `#{고객명}님, #{브랜드명} 입주·이사 청소 예약 안내입니다.

■ 총 금액: #{총금액}원
■ 예약금: #{예약금}원
■ 청소일: #{청소일} #{시간대}

아래 [발주서 작성] 버튼에서 예약확정서를 작성해 주세요.
작성 완료 후 담당 팀장이 청소 전날 연락드립니다.

문의: #{문의전화}

본 알림은 예약·접수 플랫폼 「청소비서」를 통해 발송되었습니다.
실제 청소 서비스 제공 및 문의는 #{업체명}(#{문의전화})으로 연락해 주세요.
청소비서는 예약 중개·접수 관리 플랫폼이며, 청소 시공의 당사자가 아닙니다.`;

const orderDone = `#{고객명}님, #{브랜드명} 입주·이사 청소 예약(발주서) 접수가 완료되었습니다.

■ 접수번호: #{접수번호}
■ 청소일: #{청소일} #{시간대}
■ 주소: #{주소}

청소 전날 저녁, 담당 팀장이 연락드릴 예정입니다.
취소·변경은 #{문의전화}로 문의해 주세요.

본 알림은 예약·접수 플랫폼 「청소비서」를 통해 발송되었습니다.
실제 청소 서비스 제공 및 문의는 #{업체명}(#{문의전화})으로 연락해 주세요.
청소비서는 예약 중개·접수 관리 플랫폼이며, 청소 시공의 당사자가 아닙니다.`;

const schedule = `#{고객명}님, #{브랜드명} 입주·이사 청소 예약 일정을 안내드립니다.

■ 청소일: #{청소일} #{시간대}
■ 주소: #{주소}

취소·변경이 필요하시면 #{무위약마감일}까지 #{문의전화}로 말씀해 주세요.
#{무위약마감일}까지 연락 주시면 위약금 없이 처리해 드립니다.
이후 취소·변경 시에는 위약금이 발생할 수 있습니다.

자세한 취소·변경·위약금 기준은 아래 [안내사항 확인] 버튼을 눌러 확인해 주세요.
본 알림은 예약·접수 플랫폼 「청소비서」를 통해 발송되었습니다.
청소비서는 예약 중개·접수 관리 플랫폼이며, 청소 시공의 당사자가 아닙니다.`;

const orderButton = {
  type: 'WL',
  name: '발주서 작성',
  mobileUrl: 'https://www.cbiseo.com/order/#{발주토큰}?tenant=#{업체코드}&brand=#{브랜드코드}',
  pcUrl: 'https://www.cbiseo.com/order/#{발주토큰}?tenant=#{업체코드}&brand=#{브랜드코드}',
};
const infoButton = {
  type: 'WL',
  name: '안내사항 확인',
  mobileUrl: 'https://www.cbiseo.com/info?tenant=#{업체코드}&brand=#{브랜드코드}',
  pcUrl: 'https://www.cbiseo.com/info?tenant=#{업체코드}&brand=#{브랜드코드}',
};

function source(name: string, content: string, title: string, emphasizeType: string, buttons: BrandTemplateSource['buttons']): BrandTemplateSource {
  return {
    name,
    category: '예약',
    emphasizeType,
    title,
    extra: '고객관리 솔루션 - 청소비서',
    content,
    buttons,
  };
}

const cases: BrandTemplateSource[] = [
  source('[고객] 예약(발주서) 접수 완료', orderDone, '#{브랜드명} 예약 접수 완료', '강조표기형', [
    { ...orderButton, name: '발주서 확인' },
    infoButton,
  ]),
  source('[고객] 발주서 작성·예약 안내', orderLink, '', '강조 없음', [orderButton]),
  source('[고객] 예약 일정 확인(무위약 마감일)', schedule, '#{브랜드명} 청소 일정 안내', '강조표기형', [
    { ...orderButton, name: '발주서 확인' },
    infoButton,
  ]),
];

describe('업체 채널용 알림톡 문구', () => {
  for (const platform of cases) {
    it(platform.name, () => {
      const variant = buildBrandTemplateVariant(platform);
      assert.equal(variant.content.includes('청소비서'), false);
      assert.equal(variant.content.endsWith('\n\n궁금한 점은 이 대화방에 바로 남겨 주세요.'), true);
      assert.equal(variant.content.endsWith('\n'), false);
      assert.equal(variant.extra, platform.emphasizeType === '강조표기형' ? '청소 예약 안내' : '');
      assert.equal(variant.name, platform.name);
      assert.equal(variant.category, platform.category);
      assert.equal(variant.emphasizeType, platform.emphasizeType);
      assert.equal(variant.title, platform.title);
      assert.deepEqual(variant.buttons, platform.buttons);
      const before = new Set(templateTokens(platform));
      for (const token of templateTokens(variant)) {
        assert.equal(before.has(token), true, token);
      }
      const again = buildBrandTemplateVariant(variant);
      assert.equal(again.content, variant.content);
      assert.equal(
        again.content.split('\n').filter((line) => line.trim() === '궁금한 점은 이 대화방에 바로 남겨 주세요.').length,
        1,
      );
    });
  }

  it('강조 유형은 0이 강조 없음이다', () => {
    assert.equal(emphasizeTypeLabel(0), '강조 없음');
    assert.equal(emphasizeTypeLabel(1), '강조표기형');
    assert.equal(emphasizeTypeLabel(2), '이미지형');
    const done = buildBrandTemplateVariant({ ...cases[0], emphasizeType: emphasizeTypeLabel(1) });
    const link = buildBrandTemplateVariant({ ...cases[1], emphasizeType: emphasizeTypeLabel(0) });
    assert.equal(done.emphasizeType, '강조표기형');
    assert.equal(link.emphasizeType, '강조 없음');
  });

  it('보조문구는 강조표기형만 바꾼다', () => {
    assert.equal(readBrandExtra('강조표기형', '고객관리 솔루션 - 청소비서', ''), '청소 예약 안내');
    assert.equal(readBrandExtra('강조표기형', '', '고객관리 솔루션 - 청소비서'), '청소 예약 안내');
    assert.equal(readBrandExtra('강조 없음', '고객관리 솔루션 - 청소비서', '고객관리 솔루션 - 청소비서'), '');
  });

  it('카테고리는 2단계다', () => {
    const done = brandTemplateCopyMeta('CBISEO_CUST_ORDER_DONE');
    const link = brandTemplateCopyMeta('CBISEO_CUST_ORDER_LINK');
    const schedule = brandTemplateCopyMeta('CBISEO_CUST_SCHEDULE_D2');
    assert.equal(done.emphasizeType, '강조표기형');
    assert.equal(link.emphasizeType, '강조 없음');
    assert.equal(schedule.emphasizeType, '강조표기형');
    assert.equal(readBrandExtra(done.emphasizeType, '', done.platformExtra), '청소 예약 안내');
    assert.equal(readBrandExtra(schedule.emphasizeType, '', schedule.platformExtra), '청소 예약 안내');
    assert.equal(readBrandExtra(link.emphasizeType, '고객관리 솔루션 - 청소비서', ''), '');
    assert.equal(brandTemplateCategory('CBISEO_CUST_ORDER_DONE'), '예약 > 예약완료/예약내역');
    assert.equal(brandTemplateCategory('CBISEO_CUST_ORDER_LINK'), '예약 > 예약완료/예약내역');
    assert.equal(brandTemplateCategory('CBISEO_CUST_SCHEDULE_D2'), '예약 > 예약상태');
  });
});
