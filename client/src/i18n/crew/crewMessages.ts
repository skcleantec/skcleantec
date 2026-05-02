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
  'crew.layout.navSettlement': {
    ko: '정산',
    th: 'สรุปค่าจ้าง',
  },
  'crew.layout.navTeamExpenses': {
    ko: '팀 지출',
    th: 'ค่าใช้จ่ายทีม',
  },
  'crew.layout.navSettings': {
    ko: '설정',
    th: 'ตั้งค่า',
  },
  'crew.layout.logout': {
    ko: '로그아웃',
    th: 'ออกจากระบบ',
  },
  'crew.layout.goAdmin': {
    ko: '관리자로 가기',
    th: 'ไปผู้ดูแลระบบ',
  },
  'crew.layout.navAriaLabel': {
    ko: '크루 메뉴',
    th: 'เมนูครูว์',
  },
  'crew.layout.navScrollHint': {
    ko: '메뉴가 잘리면 좌우로 밀어 보세요.',
    th: 'ถ้าเมนูถูกตัด ให้เลื่อนซ้าย-ขวา',
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
  /** 현장 미팅(팀장 지정). 모바일은 차량 옆에 태국어 라벨로 표시 */
  'crew.schedule.colMeeting': {
    ko: '미팅',
    th: 'เวลานัดหมาย',
  },
  /** 팀장이 미팅 시각을 수정한 뒤 시간 옆 배지 — 본문은 태국어(한국어는 title·접근성용) */
  'crew.schedule.meetingTimeEditedBadge': {
    ko: '수정됨',
    th: 'แก้ไขแล้ว',
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

  /** CrewSettlementPage — 정산·정산표 */
  'crew.settlement.pageTitle': {
    ko: '정산',
    th: 'สรุปค่าจ้าง',
  },
  'crew.settlement.pageIntro': {
    ko: '관리자 급여 화면과 같은 방식으로 산출된 참고 금액입니다. 설정·정산 처리는 관리자만 할 수 있습니다.',
    th: 'ยอดอ้างอิงคำนวณแบบเดียวกับผู้ดูแลระบบ การตั้งค่าและปิดบัญชีทำได้เฉพาะผู้ดูแล',
  },
  'crew.settlement.pageIntroToggleAria': {
    ko: '정산 화면 안내',
    th: 'คำอธิบายหน้าสรุปค่าจ้าง',
  },
  'crew.settlement.tabSheet': {
    ko: '정산표',
    th: 'ตารางค่าจ้าง',
  },
  'crew.settlement.tabExpenses': {
    ko: '팀 지출',
    th: 'ค่าใช้จ่ายทีม',
  },
  'crew.settlement.passwordPrompt': {
    ko: '조장 비밀번호',
    th: 'รหัสหัวหน้ากลุ่ม',
  },
  'crew.settlement.passwordHint': {
    ko: '관리자가 그룹에 설정한 「설정용 비밀번호」와 동일합니다.',
    th: 'ใช้รหัสเดียวกับ 「รหัสตั้งค่า」ที่ผู้ดูแลตั้งให้กลุ่ม',
  },
  'crew.settlement.passwordSubmit': {
    ko: '확인 후 불러오기',
    th: 'ยืนยันแล้วโหลด',
  },
  'crew.settlement.menuGateLead': {
    ko: '정산표와 팀 지출 메뉴를 이용하려면 조장 비밀번호가 필요합니다.',
    th: 'หากต้องการใช้เมนูตารางค่าจ้างและค่าใช้จ่ายทีม ต้องกรอกรหัสหัวหน้ากลุ่ม',
  },
  'crew.settlement.menuGateVerifyFail': {
    ko: '비밀번호 확인에 실패했습니다.',
    th: 'ยืนยันรหัสผ่านไม่สำเร็จ',
  },
  'crew.settlement.loadFail': {
    ko: '정산표를 불러오지 못했습니다.',
    th: 'โหลดตารางไม่สำเร็จ',
  },
  'crew.settlement.sheetEmpty': {
    ko: '이 달에 표시할 풀 팀원 행이 없습니다. (그룹에 연결된 활성 팀원만 표시)',
    th: 'ไม่มีแถวในสายพูลในเดือนนี้ (แสดงเฉพาะสมาชิกที่ผูกกับกลุ่ม)',
  },
  'crew.settlement.sheetColName': {
    ko: '이름',
    th: 'ชื่อ',
  },
  'crew.settlement.sheetColPayDay': {
    ko: '급여일',
    th: 'วันจ่าย',
  },
  'crew.settlement.sheetColDays': {
    ko: '일수',
    th: 'วัน',
  },
  'crew.settlement.sheetColSettlement': {
    ko: '정산 여부',
    th: 'สถานะชำระ',
  },
  'crew.settlement.sheetSettlementDone': {
    ko: '정산완료',
    th: 'ชำระแล้ว',
  },
  'crew.settlement.sheetSettlementPending': {
    ko: '미정산',
    th: 'ยังไม่ชำระ',
  },
  'crew.settlement.sheetColNet': {
    ko: '실지급 예상',
    th: 'จ่ายสุทธิ (ประมาณ)',
  },
  'crew.settlement.nameTapHint': {
    ko: '이름을 누르면 귀속 접수·지출 등 상세 내역을 볼 수 있습니다.',
    th: 'แตะชื่อเพื่อดูรายละเอียดงานในช่วงนับเงินและค่าใช้จ่าย',
  },
  'crew.settlement.sheetCompactHint': {
    ko: '좁은 화면에서는 표를 좌우로 스크롤할 수 있습니다.',
    th: 'จอแคบเลื่อนซ้าย-ขวาได้',
  },
  /** 모바일 정산표 카드 — 급여일·근무일 한 줄 */
  'crew.settlement.sheetMobileStats': {
    ko: '{pay} · 근무 {n}일',
    th: '{pay} · {n} วัน',
  },
  'crew.settlement.sheetMobileOpenDetail': {
    ko: '상세 보기',
    th: 'ดูรายละเอียด',
  },
  'crew.settlement.sheetMobileTapFooter': {
    ko: '카드를 누르면 급여·현장 상세를 볼 수 있습니다.',
    th: 'แตะการ์ดเพื่อดูรายละเอียดค่าจ้างและงาน',
  },
  'crew.settlement.detailMonthHeading': {
    ko: '귀속 월: {ym}',
    th: 'เดือนอ้างอิง: {ym}',
  },
  'crew.settlement.detailClose': {
    ko: '닫기',
    th: 'ปิด',
  },
  'crew.settlement.detailLoading': {
    ko: '상세를 불러오는 중…',
    th: 'กำลังโหลดรายละเอียด…',
  },
  'crew.settlement.detailLoadFail': {
    ko: '상세를 불러오지 못했습니다.',
    th: 'โหลดรายละเอียดไม่สำเร็จ',
  },
  'crew.settlement.detailPeriod': {
    ko: '귀속 기간',
    th: 'ช่วงที่นับเงิน',
  },
  'crew.settlement.detailPayDayLabel': {
    ko: '급여 지급일',
    th: 'วันจ่ายเงินเดือน',
  },
  'crew.settlement.detailUnit': {
    ko: '일당',
    th: 'ค่าจ้างต่อวัน',
  },
  'crew.settlement.detailSysDays': {
    ko: '자동 근무일',
    th: 'วันทำงานอัตโนมัติ',
  },
  'crew.settlement.detailManualDays': {
    ko: '수기 추가 일수',
    th: 'วันเพิ่มด้วยมือ',
  },
  'crew.settlement.detailJobTotal': {
    ko: '근무일수 합계',
    th: 'วันทำงานรวม',
  },
  'crew.settlement.detailGross': {
    ko: '산정액',
    th: 'ยอดคำนวณ',
  },
  'crew.settlement.detailExpenseDeduction': {
    ko: '크루 지출 차감',
    th: 'หักค่าใช้จ่ายครูว์',
  },
  'crew.settlement.detailNet': {
    ko: '실지급 예상',
    th: 'จ่ายสุทธิ (ประมาณ)',
  },
  'crew.settlement.detailSectionInquiries': {
    ko: '귀속 접수 내역',
    th: 'งานในช่วงนับเงิน',
  },
  'crew.settlement.detailThPrefDate': {
    ko: '예약일',
    th: 'วันนัด',
  },
  'crew.settlement.detailThCustomer': {
    ko: '고객',
    th: 'ลูกค้า',
  },
  'crew.settlement.detailThInquiryNo': {
    ko: '접수번호',
    th: 'เลขงาน',
  },
  'crew.settlement.detailSectionExpenses': {
    ko: '등록 지출',
    th: 'ค่าใช้จ่ายที่บันทึก',
  },
  'crew.settlement.detailExpenseMemo': {
    ko: '메모',
    th: 'หมายเหตุ',
  },
  'crew.settlement.detailExpenseGroup': {
    ko: '크루 그룹',
    th: 'กลุ่มครูว์',
  },
  'crew.settlement.detailExpenseAt': {
    ko: '등록일시',
    th: 'เวลาบันทึก',
  },
  'crew.settlement.detailAttachments': {
    ko: '영수증',
    th: 'ใบเสร็จ',
  },
  'crew.settlement.detailAttachCount': {
    ko: '{count}장',
    th: '{count} ใบ',
  },
  'crew.settlement.detailSectionSettlement': {
    ko: '관리자 정산',
    th: 'การชำระ (ผู้ดูแลระบบ)',
  },
  'crew.settlement.detailSettled': {
    ko: '이번 달 정산 완료',
    th: 'ชำระเดือนนี้แล้ว',
  },
  'crew.settlement.detailNotSettled': {
    ko: '이번 달 미정산',
    th: 'เดือนนี้ยังไม่ชำระ',
  },
  'crew.settlement.detailPaidAmount': {
    ko: '확정 금액',
    th: 'ยอดที่ปิดบัญชี',
  },
  'crew.settlement.detailPaymentHistory': {
    ko: '과거 정산 내역',
    th: 'ประวัติชำระย้อนหลัง',
  },
  'crew.settlement.detailHistorySum': {
    ko: '누적 정산 합계',
    th: 'ยอดชำระสะสม',
  },
  'crew.settlement.detailNotesKoNotice': {
    ko: '아래 안내 문구는 시스템 기본어(한국어)입니다.',
    th: 'ข้อความด้านล่างเป็นภาษาเกาหลีจากระบบ',
  },
  'crew.settlement.detailEmptyLines': {
    ko: '이 귀속 기간에 포함된 접수가 없습니다.',
    th: 'ไม่มีงานในช่วงนี้',
  },
  'crew.settlement.detailEmptyExpense': {
    ko: '등록된 크루 지출이 없습니다.',
    th: 'ไม่มีค่าใช้จ่ายที่บันทึก',
  },

  /** CrewExpensesPage — 지출 */
  'crew.layout.navExpenses': {
    ko: '지출',
    th: 'ค่าใช้จ่าย',
  },
  'crew.expenses.title': {
    ko: '팀 지출',
    th: 'ค่าใช้จ่ายของทีม',
  },
  'crew.expenses.intro': {
    ko: '귀속 월을 선택한 뒤, 지출 내역을 확인할 수 있습니다. 그룹장만 새 지출을 등록하거나 삭제할 수 있습니다.',
    th: 'เลือกเดือนที่เกี่ยวข้องแล้วดูรายการค่าใช้จ่าย เฉพาะหัวหน้ากลุ่มเพิ่มหรือลบได้',
  },
  'crew.expenses.monthLabel': {
    ko: '귀속 월',
    th: 'เดือนที่เกี่ยวข้อง',
  },
  'crew.expenses.memberLabel': {
    ko: '팀원',
    th: 'พนักงาน',
  },
  'crew.expenses.amountLabel': {
    ko: '금액 (원)',
    th: 'จำนวนเงิน (วอน)',
  },
  'crew.expenses.memoLabel': {
    ko: '메모',
    th: 'หมายเหตุ',
  },
  'crew.expenses.imagesLabel': {
    ko: '영수증 사진',
    th: 'รูปใบเสร็จ',
  },
  'crew.expenses.imagesHint': {
    ko: '여러 장 선택할 수 있습니다.',
    th: 'เลือกได้หลายรูป',
  },
  'crew.expenses.submit': {
    ko: '등록',
    th: 'บันทึก',
  },
  'crew.expenses.leaderOnly': {
    ko: '그룹장만 지출을 등록·삭제할 수 있습니다.',
    th: 'เฉพาะหัวหน้ากลุ่มบันทึกหรือลบได้',
  },
  'crew.expenses.loading': {
    ko: '불러오는 중…',
    th: 'กำลังโหลด…',
  },
  'crew.expenses.empty': {
    ko: '이 달에 등록된 지출이 없습니다.',
    th: 'ไม่มีรายการในเดือนนี้',
  },
  'crew.expenses.delete': {
    ko: '삭제',
    th: 'ลบ',
  },
  'crew.expenses.saved': {
    ko: '등록되었습니다.',
    th: 'บันทึกแล้ว',
  },
  'crew.expenses.deleted': {
    ko: '삭제되었습니다.',
    th: 'ลบแล้ว',
  },
  'crew.expenses.errAmount': {
    ko: '금액은 1원 이상 숫자로 입력해 주세요.',
    th: 'กรุณากรอกจำนวนเงินเป็นตัวเลขอย่างน้อย 1 วอน',
  },
  'crew.expenses.errMember': {
    ko: '팀원을 선택해 주세요.',
    th: 'กรุณาเลือกพนักงาน',
  },
  'crew.expenses.confirmDelete': {
    ko: '이 지출 내역을 삭제할까요?',
    th: 'ต้องการลบรายการนี้หรือไม่?',
  },
  'crew.expenses.attachShort': {
    ko: '첨부',
    th: 'แนบ',
  },
} as const;

export type CrewMessageId = keyof typeof crewMessages;
