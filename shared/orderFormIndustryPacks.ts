/**
 * 발주서 업종 팩 — 고르면 칸이 자동으로 깔린다.
 * 이름·전화·주소·서비스희망일은 양식 공통 필수라 여기에 넣지 않는다.
 * 전용 칸은 systemField 없이 JSON으로 저장한다.
 */

export type OrderFormIndustryPackId =
  | 'move_in'
  | 'aircon'
  | 'appliance'
  | 'grout'
  | 'moving'
  | 'pest'
  | 'office';

export type OrderFormIndustryPackCustomField = {
  fieldKey: string;
  label: string;
  helpText?: string;
  inputType:
    | 'TEXT'
    | 'TEXTAREA'
    | 'NUMBER'
    | 'DATE'
    | 'SELECT'
    | 'MULTISELECT'
    | 'ADDRESS';
  options?: string[];
  required?: boolean;
  showInInquiryList?: boolean;
};

export type OrderFormIndustryPack = {
  id: OrderFormIndustryPackId;
  title: string;
  defaultFormTitle: string;
  description: string;
  emoji: string;
  /** Iconify line-md 이름 (접두어 없음) */
  icon: string;
  soomgoAliases: string[];
  /** 공통 필수 제외, 켤 접수 칸 */
  systemFieldKeys: string[];
  customFields: OrderFormIndustryPackCustomField[];
  photosOn: boolean;
};

export const ORDER_FORM_INDUSTRY_PACKS: OrderFormIndustryPack[] = [
  {
    id: 'move_in',
    title: '입주청소',
    defaultFormTitle: '입주청소 발주서',
    description: '평수·방구조·이사일이 필요합니다.',
    emoji: '🏠',
    icon: 'home',
    soomgoAliases: ['이사/입주 청소업체', '입주사전점검 대행'],
    systemFieldKeys: [
      'preferredTime',
      'propertyType',
      'buildingType',
      'moveInDate',
      'areaPyeong',
      'roomCount',
      'bathroomCount',
      'balconyCount',
      'kitchenCount',
      'specialNotes',
    ],
    customFields: [],
    photosOn: false,
  },
  {
    id: 'aircon',
    title: '에어컨',
    defaultFormTitle: '에어컨 청소 발주서',
    description: '기종과 대수만 있으면 됩니다. 평수·방 개수는 빼 둡니다.',
    emoji: '❄️',
    icon: 'cloud',
    soomgoAliases: ['에어컨 청소', '시스템에어컨 청소', '실외기 청소'],
    systemFieldKeys: ['preferredTime', 'specialNotes'],
    customFields: [
      {
        fieldKey: 'ac_units',
        label: '청소할 에어컨',
        helpText: '기종을 고르고 대수는 상세에 적어 주세요. 여러 대면 상세에 나눠 적습니다.',
        inputType: 'SELECT',
        options: ['벽걸이', '스탠드', '천장형 1·2way', '천장형 4way', '2in1 세트', '원형(360°) 천장형', '실외기 추가'],
        required: true,
        showInInquiryList: true,
      },
      {
        fieldKey: 'ac_unit_count',
        label: '에어컨 대수',
        inputType: 'NUMBER',
        required: true,
        showInInquiryList: true,
      },
      {
        fieldKey: 'ac_detail_notes',
        label: '에어컨 상세',
        helpText: '브랜드·모델, 곰팡이·냄새, 층고·사다리',
        inputType: 'TEXTAREA',
      },
    ],
    photosOn: false,
  },
  {
    id: 'appliance',
    title: '가전·가구',
    defaultFormTitle: '가전·가구 청소 발주서',
    description: '매트리스·세탁기·소파처럼 품목과 대수를 받습니다.',
    emoji: '🛏️',
    icon: 'list',
    soomgoAliases: ['침대/매트리스 청소', '세탁기 청소', '소파 청소', '후드 청소', '냉장고 청소', '가구 청소'],
    systemFieldKeys: ['preferredTime', 'specialNotes'],
    customFields: [
      {
        fieldKey: 'appliance_item',
        label: '청소 품목',
        inputType: 'SELECT',
        options: ['매트리스', '세탁기', '소파', '후드', '냉장고', '기타'],
        required: true,
        showInInquiryList: true,
      },
      {
        fieldKey: 'appliance_count',
        label: '대수·개수',
        inputType: 'NUMBER',
        required: true,
      },
      {
        fieldKey: 'appliance_size',
        label: '사이즈·규격',
        inputType: 'TEXT',
        helpText: '예: 퀸 매트리스, 드럼 21kg',
      },
    ],
    photosOn: false,
  },
  {
    id: 'grout',
    title: '줄눈·코킹',
    defaultFormTitle: '줄눈 시공 발주서',
    description: '욕실 수·구역·색상을 받습니다. 방 개수는 빼 둡니다.',
    emoji: '🪟',
    icon: 'check-list-3',
    soomgoAliases: ['줄눈 시공', '코킹 시공'],
    systemFieldKeys: ['propertyType', 'bathroomCount', 'specialNotes'],
    customFields: [
      {
        fieldKey: 'grout_areas',
        label: '시공 구역',
        inputType: 'MULTISELECT',
        options: ['욕실', '주방', '현관', '발코니', '기타'],
        required: true,
        showInInquiryList: true,
      },
      {
        fieldKey: 'has_bathtub',
        label: '욕조',
        inputType: 'SELECT',
        options: ['있음', '없음'],
      },
      {
        fieldKey: 'grout_color',
        label: '줄눈 색상',
        inputType: 'TEXT',
        helpText: '당일 현장에서 고를 수도 있습니다.',
      },
    ],
    photosOn: true,
  },
  {
    id: 'moving',
    title: '이사',
    defaultFormTitle: '이사 발주서',
    description: '출발·도착, 층수, 엘리베이터·사다리차가 필요합니다.',
    emoji: '🪜',
    icon: 'map-marker',
    soomgoAliases: ['가정이사(투룸 이상)', '원룸/소형 이사', '사무실/상업공간 이사', '용달/화물 운송'],
    systemFieldKeys: ['areaPyeong', 'propertyType', 'preferredTime', 'specialNotes'],
    customFields: [
      {
        fieldKey: 'dest_address',
        label: '도착 주소',
        helpText: '출발지는 위 주소입니다.',
        inputType: 'ADDRESS',
        required: true,
      },
      {
        fieldKey: 'floor_info',
        label: '출발·도착 층수',
        inputType: 'TEXT',
        helpText: '예: 출발 3층 / 도착 12층',
        required: true,
      },
      {
        fieldKey: 'has_elevator',
        label: '엘리베이터',
        inputType: 'SELECT',
        options: ['양쪽 있음', '출발만', '도착만', '없음'],
        required: true,
      },
      {
        fieldKey: 'needs_ladder',
        label: '사다리차',
        inputType: 'SELECT',
        options: ['필요', '없음', '현장 확인'],
      },
      {
        fieldKey: 'packing_type',
        label: '이사 방식',
        inputType: 'SELECT',
        options: ['포장', '반포장', '일반'],
        required: true,
        showInInquiryList: true,
      },
    ],
    photosOn: false,
  },
  {
    id: 'pest',
    title: '방역',
    defaultFormTitle: '방역 발주서',
    description: '해충 종류와 평·세대를 받습니다.',
    emoji: '🐜',
    icon: 'alert',
    soomgoAliases: ['방역소독', '해충방역', '바퀴벌레 퇴치'],
    systemFieldKeys: ['areaPyeong', 'propertyType', 'preferredTime', 'specialNotes'],
    customFields: [
      {
        fieldKey: 'pest_type',
        label: '해충 종류',
        inputType: 'MULTISELECT',
        options: ['바퀴벌레', '개미', '빈대', '쥐', '기타'],
        required: true,
        showInInquiryList: true,
      },
      {
        fieldKey: 'pest_unit',
        label: '작업 단위',
        inputType: 'SELECT',
        options: ['평', '세대', '실'],
      },
      {
        fieldKey: 'has_pet',
        label: '반려동물',
        inputType: 'SELECT',
        options: ['없음', '있음(당일 외출)', '있음(현장 있음)'],
      },
      {
        fieldKey: 'needs_revisit',
        label: '재방문',
        inputType: 'SELECT',
        options: ['1회', '2회 이상', '상담 후'],
      },
    ],
    photosOn: false,
  },
  {
    id: 'office',
    title: '사무실·준공',
    defaultFormTitle: '사무실·준공 청소 발주서',
    description: '공간 종류와 층·자재 반입을 받습니다.',
    emoji: '🏢',
    icon: 'computer',
    soomgoAliases: ['사무실/상업공간 청소업체', '준공 청소', '건물내부 청소(바닥/계단/화장실)'],
    systemFieldKeys: ['areaPyeong', 'preferredTime', 'specialNotes'],
    customFields: [
      {
        fieldKey: 'space_type',
        label: '공간 유형',
        inputType: 'SELECT',
        options: ['사무실', '상가', '준공 현장', '기타'],
        required: true,
        showInInquiryList: true,
      },
      {
        fieldKey: 'floor_count',
        label: '층수',
        inputType: 'NUMBER',
      },
      {
        fieldKey: 'job_kind',
        label: '작업 구분',
        inputType: 'SELECT',
        options: ['준공', '이사 전', '이사 후', '정기'],
      },
      {
        fieldKey: 'material_in',
        label: '자재 반입',
        inputType: 'SELECT',
        options: ['가능', '제한 있음', '확인 필요'],
      },
    ],
    photosOn: true,
  },
];

export function findOrderFormIndustryPack(id: string | null | undefined): OrderFormIndustryPack | null {
  if (!id) return null;
  return ORDER_FORM_INDUSTRY_PACKS.find((p) => p.id === id) ?? null;
}

export function isOrderFormIndustryPackId(id: string): id is OrderFormIndustryPackId {
  return ORDER_FORM_INDUSTRY_PACKS.some((p) => p.id === id);
}
