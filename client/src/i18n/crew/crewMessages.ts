/**
 * 크루(팀원 공유 계정) UI — 문구 키 + ko/th 병기용 원문.
 * 다른 화면 번역은 이 파일에 키를 추가해 확장한다.
 */
export const crewMessages = {
  /** 공통 */
  'crew.common.loading': {
    ko: '불러오는 중…',
    th: 'กำลังโหลด…',
  },

  /** CrewLayout — 헤더·내비 */
  'crew.layout.titlePrefix': {
    ko: '크루',
    th: 'ครูว์',
  },
  'crew.layout.roleLeader': {
    ko: '그룹장(명단 편집 가능)',
    th: 'หัวหน้ากลุ่ม (แก้รายชื่อรายวันได้)',
  },
  'crew.layout.roleMember': {
    ko: '팀원(조회)',
    th: 'พนักงาน (ดูอย่างเดียว)',
  },
  'crew.layout.navHome': {
    ko: '홈',
    th: 'หน้าแรก',
  },
  'crew.layout.navSchedule': {
    ko: '현장 일정',
    th: 'ตารางงานภาคสนาม',
  },
  'crew.layout.navRoster': {
    ko: '일자 명단',
    th: 'รายชื่อรายวัน',
  },
  'crew.layout.navSettings': {
    ko: '설정',
    th: 'ตั้งค่า',
  },
  'crew.layout.logout': {
    ko: '로그아웃',
    th: 'ออกจากระบบ',
  },

  /** CrewHomePage */
  'crew.home.title': {
    ko: '크루 홈',
    th: 'หน้าแรกครูว์',
  },
  'crew.home.intro': {
    ko: '그룹 {groupName}으로 로그인했습니다. 멤버는 모두 같은 화면을 봅니다.',
    th: 'เข้าสู่ระบบในนามกลุ่ม {groupName} สมาชิกทุกคนใช้หน้าจอเดียวกัน',
  },
  'crew.home.roleLeader': {
    ko: '그룹장 — 「일자 명단」에서 날짜별 투입 가능 인원을 지정할 수 있습니다.',
    th: 'หัวหน้ากลุ่ม — กำหนดผู้พร้อมทำงานในแต่ละวันได้ที่ 「รายชื่อรายวัน」',
  },
  'crew.home.roleMember': {
    ko: '팀원 — 명단 조회만 가능합니다. (그룹장은 관리자가 멤버에서 지정)',
    th: 'พนักงาน — ดูรายชื่อได้อย่างเดียว (ผู้ดูแลระบบกำหนดหัวหน้ากลุ่มในสมาชิก)',
  },
  'crew.home.scheduleLink': {
    ko: '현장 일정',
    th: 'งานภาคสนาม',
  },
  'crew.home.scheduleHint': {
    ko: '— 날짜 선택 · 팀원·배정 팀장·시간·차량을 한눈에.',
    th: '— เลือกวันที่ · พนักงาน·หัวหน้า·เวลา·ทะเบียนรถ',
  },
  'crew.home.membersHeading': {
    ko: '멤버',
    th: 'สมาชิก',
  },
  'crew.home.statsTitle': {
    ko: '이달 접수 건수',
    th: 'งานที่เข้ามาในเดือนนี้',
  },
  'crew.home.statsFootnote': {
    ko: '취소·보류 접수는 빼고, 현장 인원 메모에 이름이 적힌 건만 세며 현장 일정 화면과 같은 기준입니다.',
    th: 'ไม่นับงานที่ยกเลิก/พัก และนับเฉพาะที่ระบุชื่อในโน้ตพนักงาน ตามหน้าตารางภาคสนาม',
  },
  'crew.home.statsLoading': {
    ko: '불러오는 중…',
    th: 'กำลังโหลด…',
  },
  'crew.home.statsError': {
    ko: '실적을 불러오지 못했습니다.',
    th: 'โหลดสถิติไม่สำเร็จ',
  },
  'crew.home.prevMonthAria': {
    ko: '이전 달',
    th: 'เดือนก่อน',
  },
  'crew.home.nextMonthAria': {
    ko: '다음 달',
    th: 'เดือนถัดไป',
  },
  'crew.home.callAria': {
    ko: '전화 걸기',
    th: 'โทรออก',
  },
  'crew.home.statsUnit': {
    ko: '건',
    th: 'งาน',
  },

  /** CrewSettingsPage — 그룹장만 표시명(태국어 등) */
  'crew.settings.title': {
    ko: '멤버 표시 이름',
    th: 'ชื่อแสดงสมาชิก',
  },
  'crew.settings.intro': {
    ko: '한글 이름 아래에 보조 이름(태국어 등)을 넣으면 홈·일정·명단에서 팀원이 본인을 찾기 쉽습니다. 각 팀원 행의 「저장」만 해당 사람 표시명을 반영합니다.',
    th: 'ใส่ชื่อรองใต้ชื่อเกาหลีเพื่อให้หาตัวเองง่าย กด「บันทึก」ในแถวนั้นเพื่อบันทึกเฉพาะคนนั้น',
  },
  'crew.settings.helpToggleAria': {
    ko: '설명 보기',
    th: 'ดูคำอธิบาย',
  },
  'crew.settings.colName': {
    ko: '이름',
    th: 'ชื่อ',
  },
  'crew.settings.colDisplayTh': {
    ko: '보조 표시명',
    th: 'ชื่อแสดงเสริม',
  },
  'crew.settings.placeholderTh': {
    ko: '태국어 이름을 넣으세요',
    th: 'กรุณาใส่ชื่อภาษาไทย',
  },
  'crew.settings.save': {
    ko: '저장',
    th: 'บันทึก',
  },
  'crew.settings.saving': {
    ko: '저장 중…',
    th: 'กำลังบันทึก…',
  },
  'crew.settings.saved': {
    ko: '저장되었습니다.',
    th: 'บันทึกแล้ว',
  },
  'crew.settings.saveFail': {
    ko: '저장에 실패했습니다.',
    th: 'บันทึกไม่สำเร็จ',
  },
  'crew.settings.leaderOnly': {
    ko: '그룹장만 멤버 표시 이름을 바꿀 수 있습니다. (관리자가 그룹에서 그룹장을 지정해야 합니다.)',
    th: 'เฉพาะหัวหน้ากลุ่มแก้ชื่อแสดงได้ (ผู้ดูแลต้องกำหนดหัวหน้ากลุ่ม)',
  },
  'crew.settings.backHome': {
    ko: '홈으로',
    th: 'กลับหน้าแรก',
  },
  'crew.settings.editPhone': {
    ko: '수정',
    th: 'แก้',
  },
  'crew.settings.phoneModalTitle': {
    ko: '연락처',
    th: 'เบอร์โทร',
  },
  'crew.settings.phoneModalHint': {
    ko: '비우고 저장하면 연락처를 지웁니다.',
    th: 'เว้นว่างแล้วบันทึก = ลบเบอร์',
  },
  'crew.settings.phoneLabel': {
    ko: '전화번호',
    th: 'โทรศัพท์',
  },
  'crew.settings.phoneModalCancel': {
    ko: '닫기',
    th: 'ปิด',
  },
  'crew.settings.phoneModalSave': {
    ko: '저장',
    th: 'บันทึก',
  },

  'crew.home.badgeGroupLeader': {
    ko: '(그룹장)',
    th: '(หัวหน้ากลุ่ม)',
  },

  /** CrewFieldSchedulePage — 7단계 */
  'crew.schedule.title': {
    ko: '현장 일정',
    th: 'งานภาคสนาม',
  },
  'crew.schedule.intro': {
    ko: '날짜 선택 · 처음은 오늘(KST)',
    th: 'เลือกวันที่ · เริ่มวันนี้(KST)',
  },
  /** 헤더 배지(한 줄) */
  'crew.schedule.headerWsOn': {
    ko: '실시간',
    th: 'สด',
  },
  'crew.schedule.headerWsOff': {
    ko: '주기',
    th: 'โหลด',
  },
  'crew.schedule.dateLabel': {
    ko: '날짜',
    th: 'วันที่',
  },
  'crew.schedule.todayButton': {
    ko: '오늘',
    th: 'วันนี้',
  },
  'crew.schedule.colAssignLeader': {
    ko: '배정 팀장',
    th: 'หัวหน้าที่มอบหมาย',
  },
  'crew.schedule.colTimeOnly': {
    ko: '시간',
    th: 'เวลา',
  },
  'crew.schedule.colVehicleOnly': {
    ko: '차량',
    th: 'ทะเบียน',
  },
  'crew.schedule.rosterOffBadge': {
    ko: '명단外',
    th: 'นอกรายชื่อ',
  },
  'crew.schedule.wsConnected': {
    ko: '실시간 연결됨',
    th: 'เชื่อมต่อเรียลไทม์แล้ว',
  },
  'crew.schedule.wsFallback': {
    ko: '실시간 끊김 · 주기 갱신',
    th: 'ตัดการเชื่อมต่อ · รีเฟรชเป็นระยะ',
  },
  'crew.schedule.emptyMonth': {
    ko: '이 달에 표시할 일정이 없습니다. 「일자 명단」에 등록된 날·접수 팀원 메모를 확인해 주세요.',
    th: 'เดือนนี้ไม่มีตารางที่แสดง กรุณาตรวจวันที่ลงใน「รายชื่อรายวัน」และบันทึกชื่อพนักงานในงานรับ',
  },
  'crew.schedule.emptyTodayHint': {
    ko: '배정 없으면 — · 팀원 메모·명단 확인',
    th: 'ไม่มีงาน = — · ตรวจบันทึก/รายชื่อ',
  },
  'crew.schedule.scrollHint': {
    ko: '표는 좌우로 스크롤할 수 있습니다.',
    th: 'เลื่อนตารางซ้าย-ขวาได้',
  },
  'crew.schedule.colDate': {
    ko: '배정일',
    th: 'วันนัด',
  },
  'crew.schedule.colMember': {
    ko: '팀원',
    th: 'พนักงาน',
  },
  'crew.schedule.colRoster': {
    ko: '명단',
    th: 'รายชื่อ',
  },
  'crew.schedule.colJob': {
    ko: '접수 · 현장',
    th: 'งานรับ · สถานที่',
  },
  'crew.schedule.colLeaders': {
    ko: '짝 팀장 · 차량',
    th: 'หัวหน้าคู่ · ทะเบียนรถ',
  },
  'crew.schedule.rosterOn': {
    ko: '명단',
    th: 'ในรายชื่อ',
  },
  'crew.schedule.rosterOff': {
    ko: '명단 외',
    th: 'นอกรายชื่อ',
  },
  'crew.schedule.rosterDash': {
    ko: '—',
    th: '—',
  },
  'crew.schedule.noJob': {
    ko: '배정된 접수 없음',
    th: 'ไม่มีงานรับที่มอบหมาย',
  },
  'crew.schedule.leadersNone': {
    ko: '미배정',
    th: 'ยังไม่มอบหมาย',
  },
  'crew.schedule.inquiryFallback': {
    ko: '접수',
    th: 'งานรับ',
  },
  'crew.schedule.emDash': {
    ko: '—',
    th: '—',
  },

  /** CrewRosterPage */
  'crew.roster.title': {
    ko: '날짜별 일할 수 있는 인원',
    th: 'จำนวนคนที่พร้อมทำงานในแต่ละวัน',
  },
  'crew.roster.hintEdit': {
    ko: '체크한 멤버만 해당 날짜에 일할 수 있는 것으로 저장됩니다.',
    th: 'เฉพาะสมาชิกที่ติ๊กจะถูกบันทึกว่าพร้อมทำงานในวันนั้น',
  },
  'crew.roster.hintView': {
    ko: '그룹장만 편집할 수 있습니다. (조회만 가능)',
    th: 'เฉพาะหัวหน้ากลุ่มแก้ไขได้ (คุณดูอย่างเดียว)',
  },
  'crew.roster.saveMonth': {
    ko: '이 달 저장',
    th: 'บันทึกเดือนนี้',
  },
  'crew.roster.saveDay': {
    ko: '저장',
    th: 'บันทึก',
  },
  'crew.roster.close': {
    ko: '닫기',
    th: 'ปิด',
  },
  'crew.roster.backToCalendar': {
    ko: '달력',
    th: 'ปฏิทิน',
  },
  'crew.roster.calendarNavHint': {
    ko: '날짜를 누르면 그날 일할 사람을 고를 수 있습니다.',
    th: 'แตะวันที่เพื่อเลือกคนทำงานในวันนั้น',
  },
  'crew.roster.prevMonthAria': {
    ko: '이전 달',
    th: 'เดือนก่อน',
  },
  'crew.roster.nextMonthAria': {
    ko: '다음 달',
    th: 'เดือนถัดไป',
  },
  'crew.roster.memberPoolHint': {
    ko: '그룹 멤버',
    th: 'สมาชิกกลุ่ม',
  },
  'crew.roster.dayEditorTitle': {
    ko: '일할 멤버 선택',
    th: 'เลือกสมาชิกที่ทำงานวันนี้',
  },
  'crew.roster.dayEditorHintLeader': {
    ko: '왼쪽에서 멤버를 눌러 선택한 뒤 → 를 누르면 오른쪽(일할 멤버)으로 옮깁니다. 오른쪽에서 선택 후 ← 를 누르면 빠집니다.',
    th: 'แตะชื่อซ้าย แล้วกด → เพื่อย้ายไปขวา (คนทำงาน). เลือกขวาแล้วกด ← เพื่อเอาออก',
  },
  'crew.roster.helpToggleAria': {
    ko: '사용 방법 보기',
    th: 'ดูวิธีใช้',
  },
  'crew.roster.columnMembers': {
    ko: '멤버',
    th: 'สมาชิก',
  },
  'crew.roster.columnWorking': {
    ko: '일할 멤버',
    th: 'คนทำงานวันนี้',
  },
  'crew.roster.transferToWorking': {
    ko: '선택한 멤버를 일할 멤버로',
    th: 'ย้ายไปคนทำงาน',
  },
  'crew.roster.transferToPool': {
    ko: '일할 멤버에서 빼기',
    th: 'นำออกจากคนทำงาน',
  },
  'crew.roster.todayBadge': {
    ko: '오늘',
    th: 'วันนี้',
  },
  'crew.roster.saving': {
    ko: '저장 중…',
    th: 'กำลังบันทึก…',
  },
  'crew.roster.colMember': {
    ko: '멤버',
    th: 'สมาชิก',
  },
  'crew.roster.scrollHint': {
    ko: '표는 좌우로 스크롤할 수 있습니다.',
    th: 'เลื่อนตารางซ้าย-ขวาได้',
  },
  'crew.roster.alertSaved': {
    ko: '저장되었습니다.',
    th: 'บันทึกสำเร็จ',
  },
  'crew.roster.alertSaveFail': {
    ko: '저장되지 않았습니다.',
    th: 'บันทึกไม่สำเร็จ',
  },
  'crew.roster.alertSaveSkipped': {
    ko: '지금은 저장할 수 없습니다. 화면을 새로고침하거나 다시 로그인한 뒤 시도해 주세요.',
    th: 'บันทึกไม่ได้ในตอนนี้ โปรดรีเฟรชหรือเข้าสู่ระบบใหม่',
  },
  /** 집계·명단 ON + 관리자가 설정용 비밀번호를 둔 경우에만 표시 */
  'crew.roster.sensitiveGateHint': {
    ko: '이 그룹은 집계에 반영되는 명단이라, 저장할 때만 관리자가 설정한 「그룹 설정용 비밀번호」를 추가로 입력해야 합니다.',
    th:
      'กลุ่มนี้ใช้รายชื่อรายวันกับการคำนวณ จึงต้องใส่「รหัสตั้งค่ากลุ่ม」ที่ผู้ดูแลตั้งไว้ เฉพาะตอนกดบันทึก',
  },
  'crew.roster.sensitivePasswordLabel': {
    ko: '설정용 비밀번호 (저장 시)',
    th: 'รหัสตั้งค่า (ตอนบันทึก)',
  },
  'crew.roster.sensitivePasswordPlaceholder': {
    ko: '관리자가 알려 준 비밀번호',
    th: 'รหัสที่ผู้ดูแลแจ้ง',
  },
  'crew.roster.modalPasswordTitle': {
    ko: '명단 저장',
    th: 'บันทึกรายชื่อ',
  },
  'crew.roster.modalPasswordHint': {
    ko: '관리자가 정한 「그룹 설정용 비밀번호」를 입력해 주세요.',
    th: 'กรุณาใส่「รหัสตั้งค่ากลุ่ม」ที่ผู้ดูแลกำหนด',
  },
  'crew.roster.modalCancel': {
    ko: '취소',
    th: 'ยกเลิก',
  },
  'crew.roster.modalConfirmSave': {
    ko: '저장',
    th: 'บันทึก',
  },
  'crew.roster.modalPasswordRequired': {
    ko: '비밀번호를 입력해 주세요.',
    th: 'กรุณาใส่รหัสผ่าน',
  },
} as const;

export type CrewMessageId = keyof typeof crewMessages;
