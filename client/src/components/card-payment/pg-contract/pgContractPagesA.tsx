import { Blank, Choice, ContractSheet, LockFee, isChecked, type ContractValues } from './pgContractChrome';

const SEAL = '/brand/service-bridge-seal.png';

type PageProps = {
  values: ContractValues;
  set: (key: string, value: string) => void;
  readOnly: boolean;
  contractNo: string;
};

function v(values: ContractValues, key: string) {
  return values[key] ?? '';
}

function field(values: ContractValues, set: PageProps['set'], readOnly: boolean, key: string, width = '40mm') {
  return <Blank width={width} value={v(values, key)} readOnly={readOnly} onChange={(next) => set(key, next)} />;
}

export function ContractPage1({ values, set, readOnly, contractNo }: PageProps) {
  return (
    <ContractSheet page={1} contractNo={contractNo}>
      <p className="pg-center">주식회사 서비스브릿지</p>
      <h1 className="pg-center">청소비서 카드결제 서비스<br />이용신청서 및 이용계약서</h1>
      <p className="pg-center pg-muted">전자계약용 이용약관</p>
      <p>이 약관은 주식회사 서비스브릿지가 작성한 계약입니다. 가맹점은 청소비서 화면에서 전자서명으로 체결합니다. 법인인감·대표자 인감은 받지 않습니다.</p>
      <p>체결된 계약서는 회사가 협력 결제대행사 주식회사 원성페이먼츠(SunshinePay)에 제출하고, 결제대행사가 심사합니다. 결제대행사는 이 계약의 서명 당사자가 아닙니다.</p>
      <p>카드 승인·매입·정산은 결제대행사가 합니다. 회사는 전자지급결제대행업자가 아니며, 심사가 끝나기 전에는 카드결제를 쓸 수 없습니다.</p>
      <h2>계약 회사</h2>
      <p>「청소비서」는 아래 회사가 운영하는 청소업체용 업무 플랫폼입니다. 이 약관의 회사는 가맹점과 카드결제 이용계약을 맺는 당사자입니다.</p>
      <table className="pg-table">
        <tbody>
          <tr><th>상호</th><td colSpan={3}>주식회사 서비스브릿지</td></tr>
          <tr>
            <th>대표자</th>
            <td>이정무 <img className="pg-seal" src={SEAL} alt="사용인감" /> (인)</td>
            <th>개업일</th>
            <td>2026년 7월 22일</td>
          </tr>
          <tr><th>사업자등록번호</th><td>138-87-04035</td><th>법인등록번호</th><td>120111-0154855</td></tr>
          <tr><th>본점 · 사업장</th><td colSpan={3}>인천광역시 연수구 송도미래로 30, 이동 801호, 엠46(송도동, 스마트밸리지식산업센터)</td></tr>
          <tr><th>업태</th><td colSpan={3}>정보통신업, 도매 및 소매업, 전문·과학 및 기술서비스업, 사업시설 관리·사업지원 및 임대서비스업</td></tr>
          <tr><th>종목</th><td colSpan={3}>응용 소프트웨어 개발 및 공급업, 전자상거래 소매업, 시스템 소프트웨어 개발 및 공급업, 자료 처리업, 광고 대행업, 건축물 일반 청소업</td></tr>
          <tr><th>세금계산서 메일</th><td colSpan={3}>tax@service-bridges.com</td></tr>
          <tr><th>계약 통지</th><td colSpan={3}>cbiseo@service-bridges.com 또는 청소비서 화면</td></tr>
        </tbody>
      </table>
      <h2>1. 가맹점 기본 정보</h2>
      <p>공동대표이면 대표자 전원의 이름, 생년월일, 휴대폰 번호를 적습니다.</p>
      <p>
        구분
        <Choice on={v(values, 'pgBizKind') === 'solo'} label="개인사업자" readOnly={readOnly} onPick={() => set('pgBizKind', 'solo')} />
        <Choice on={v(values, 'pgBizKind') === 'corp'} label="법인" readOnly={readOnly} onPick={() => set('pgBizKind', 'corp')} />
      </p>
      <p>
        과세
        <Choice on={v(values, 'pgTaxKind') === 'tax'} label="과세" readOnly={readOnly} onPick={() => set('pgTaxKind', 'tax')} />
        <Choice on={v(values, 'pgTaxKind') === 'exempt'} label="면세" readOnly={readOnly} onPick={() => set('pgTaxKind', 'exempt')} />
      </p>
    </ContractSheet>
  );
}

export function ContractPage2({ values, set, readOnly, contractNo }: PageProps) {
  const f = (key: string, width?: string) => field(values, set, readOnly, key, width);
  return (
    <ContractSheet page={2} contractNo={contractNo}>
      <table className="pg-table">
        <tbody>
          <tr><th>상호</th><td colSpan={3}>{f('[[EC_MERCHANT_NAME]]', '80mm')}</td></tr>
          <tr><th>사업자등록번호</th><td colSpan={3}>{f('[[EC_BIZ_NO]]', '50mm')}</td></tr>
          <tr><th>법인등록번호</th><td colSpan={3}>{f('pgCorpNo', '50mm')} <span className="pg-muted">개인사업자는 적지 않습니다.</span></td></tr>
          <tr><th>대표자 이름</th><td>{f('[[EC_SIGNER_NAME]]')}</td><th>생년월일</th><td>{f('pgBirth')}</td></tr>
          <tr><th>대표 전화</th><td>{f('pgTel')}</td><th>대표자 휴대폰</th><td>{f('[[EC_SIGNER_PHONE]]')}</td></tr>
          <tr><th>업태</th><td>{f('pgBizType')}</td><th>종목</th><td>{f('pgBizItem')}</td></tr>
          <tr><th>주요 판매 용역</th><td colSpan={3}>{f('pgService', '90mm')} <span className="pg-muted">예: 입주청소, 거주청소</span></td></tr>
          <tr><th>사업장 소재지</th><td colSpan={3}>{f('[[EC_SIGNER_ADDRESS]]', '110mm')}</td></tr>
          <tr><th>우편물 수령지</th><td colSpan={3}>{f('pgMailAddr', '80mm')} <span className="pg-muted">사업장과 같으면 “상동”</span></td></tr>
          <tr><th>청소비서 업체</th><td colSpan={3}>{f('pgTenantCode', '60mm')} <span className="pg-muted">업체 코드 또는 가입 상호</span></td></tr>
        </tbody>
      </table>
      <h2>2. 담당자</h2>
      <p>계약 담당과 정산 담당만 적습니다. 화면 문의는 계약 담당자에게 연락합니다.</p>
      <p>계약 담당자 이름 {f('pgStaffName')} 전화 {f('pgStaffPhone')} 이메일 {f('pgStaffMail', '46mm')}</p>
      <p>정산 담당자 이름 {f('pgSettleName')} 전화 {f('pgSettlePhone')} 세금계산서 이메일 {f('pgSettleMail', '46mm')}</p>
      <h2>3. 정산 계좌</h2>
      <p>카드 결제대금은 결제대행사가 아래 계좌로 정산합니다. 개인사업자는 예금주가 대표자 또는 상호와 같고, 법인은 상호와 같아야 합니다.</p>
      <p>은행 {f('pgBank', '28mm')} 계좌번호 {f('pgAccount', '48mm')} 예금주 {f('pgHolder')}</p>
      <p>등록비, 연관리비, 보증보험 등 담보는 결제대행사가 심사에서 요구하는 경우에만 가맹점이 결제대행사에 부담합니다. 회사는 이를 대신 내지 않으며, 가맹점 정산금에서 임의로 빼지 않습니다.</p>
      <h2>4. 수수료와 정산일</h2>
      <LockFee />
    </ContractSheet>
  );
}

export function ContractPage3({ values, set, readOnly, contractNo }: PageProps) {
  return (
    <ContractSheet page={3} contractNo={contractNo}>
      <p>여신전문금융업법 제18조의3에 따라 가맹점의 영세·중소 여부는 국세청 매출을 기준으로 반기마다 다시 매겨집니다. 카드사 원가가 바뀌면 위 수수료도 바뀔 수 있습니다. 회사는 청소비서 화면 또는 이메일로 알립니다.</p>
      <h2>5. 판매 범위</h2>
      <p>가맹점이 이 결제로 받는 돈은 신청서에 적은 청소 및 이와 직접 관련된 용역의 대가여야 합니다.</p>
      <p>상품권, 기프티콘, 포인트·게임머니 충전, 선불충전은 받지 않습니다. 결제대행사가 예외를 서면으로 허용한 경우만 가능하고, 그때는 결제대행사가 정한 추가 본인확인을 적용합니다.</p>
      <p>법령, 카드사, 결제대행사가 받지 못하게 한 업종·품목은 부속서의 기준을 따릅니다. 업종이나 판매 용역을 바꾸려면 미리 회사에 알리고, 결제대행사 심사를 다시 받아야 합니다.</p>
      <h2>6. 제출 서류</h2>
      <p>필수: 이 신청서 및 이용계약서, 사업자등록증 사본, 정산 통장 사본, 실제 소유자 확인서(뒤쪽).</p>
      <p>개인사업자: 대표자 신분증 사본(주민등록증 또는 운전면허증). 외국인은 외국인등록증 등 결제대행사가 정한 서류.</p>
      <p>법인: 법인등기사항증명서(발급 3개월 이내). 비영리는 설립 목적 서류.</p>
      <p>결제대행사가 서면 원본, 인감증명서, 보증보험, 대표자 연대보증을 요구하면 그 양식에 따릅니다. 회사는 법령 근거 없이 주민등록번호 뒷자리를 받지 않습니다.</p>
      <h2>7. 개인정보</h2>
      <h2>가. 수집·이용 (필수)</h2>
      <p>수집하는 곳: 주식회사 서비스브릿지. 결제대행사가 심사·정산을 위해 같은 항목을 다시 수집·이용할 수 있습니다.</p>
      <p>항목: 상호, 사업자등록번호, 대표자 이름·생년월일·성별·국적·전화번호, 담당자 이름·전화·이메일, 정산계좌, 실제 소유자 정보, 거래내역(결제일, 금액, 구매 용역, 고객 연락처 등 정산·민원에 필요한 범위).</p>
      <p>목적: 신청 접수, 본인·사업자 확인, 결제대행사 심사 요청, 결제 화면 연결, 정산·수수료 안내, 민원 전달, 부정 이용 방지, 법령상 의무.</p>
      <p>보유: 목적 달성 후 지체 없이 파기합니다. 전자금융거래법 등에서 거래기록을 보존하도록 한 기간(원칙 5년)은 그 기간까지 둡니다.</p>
      <p>
        동의하지 않으면 카드결제를 열 수 없습니다.
        <Choice on={isChecked(v(values, 'pgPrivacy'))} label="동의함" readOnly={readOnly} onPick={() => set('pgPrivacy', 'Y')} />
        <Choice on={v(values, 'pgPrivacy') === 'N'} label="동의하지 않음" readOnly={readOnly} onPick={() => set('pgPrivacy', 'N')} />
      </p>
      <h2>나. 제3자 제공 (필수)</h2>
    </ContractSheet>
  );
}

export function ContractPage4({ values, set, readOnly, contractNo }: PageProps) {
  const ad = (key: string) => v(values, key) === 'Y';
  return (
    <ContractSheet page={4} contractNo={contractNo}>
      <p>제공받는 자: 주식회사 원성페이먼츠. 원성페이먼츠는 가맹 심사와 승인·매입을 위해 카드사(국민, 비씨, 롯데, 삼성, 현대, 신한, 하나, NH농협 등 해당 카드사)에 대표자 이름, 생년월일, 사업자 정보와 심사에 필요한 항목을 제공합니다.</p>
      <p>목적: 가맹 심사, 거래 승인·매입·정산, 본인확인, 민원·부정거래 확인, 특정금융정보법에 따른 확인.</p>
      <p>보유: 제공 목적 달성 시 파기. 법령에 보존 기간이 있으면 그 기간.</p>
      <p>
        동의하지 않으면 심사를 진행할 수 없습니다.
        <Choice on={isChecked(v(values, 'pgShare'))} label="동의함" readOnly={readOnly} onPick={() => set('pgShare', 'Y')} />
        <Choice on={v(values, 'pgShare') === 'N'} label="동의하지 않음" readOnly={readOnly} onPick={() => set('pgShare', 'N')} />
      </p>
      <h2>다. 처리 위탁 고지</h2>
      <p>회사는 카드 승인·매입·정산 시스템 연동을 주식회사 원성페이먼츠에 위탁합니다. 카드번호, 유효기간, 비밀번호는 회사 화면에 입력하지 않으며 결제대행사 화면에서만 처리됩니다. 회사와 가맹점은 이를 저장하지 않습니다.</p>
      <h2>라. 광고 수신 (선택)</h2>
      <p>회사(서비스브릿지)가 청소비서 안내를 이메일 또는 문자로 보낼 수 있습니다. 거부해도 카드결제 이용에는 불이익이 없습니다.</p>
      <p>
        <Choice on={ad('pgAdEmail')} label="이메일 수신" readOnly={readOnly} onPick={() => set('pgAdEmail', ad('pgAdEmail') ? '' : 'Y')} />
        <Choice on={ad('pgAdSms')} label="문자 수신" readOnly={readOnly} onPick={() => set('pgAdSms', ad('pgAdSms') ? '' : 'Y')} />
        <Choice on={ad('pgAdNone')} label="받지 않음" readOnly={readOnly} onPick={() => { set('pgAdNone', 'Y'); set('pgAdEmail', ''); set('pgAdSms', ''); }} />
      </p>
      <p>대표자는 위 내용을 이해했습니다.</p>
      <p>대표자 이름: {field(values, set, readOnly, '[[EC_SIGNER_NAME]]')} 날짜: {field(values, set, readOnly, 'pgPrivacyDate', '28mm')}</p>
      <h2>8. 전자서명으로 신청</h2>
      <p>가맹점의 대표자 또는 계약 권한이 있는 관리자가 청소비서에서 이 약관에 동의하고 전자서명하면, 뒤의 이용계약 체결을 신청한 것으로 봅니다. 인감 날인은 하지 않습니다.</p>
      <p>전자서명 이름: {field(values, set, readOnly, 'pgApplyName')} 일시: {field(values, set, readOnly, 'pgApplyAt', '36mm')}</p>
      <p>가맹점 상호: {v(values, '[[EC_MERCHANT_NAME]]') || '　　　　'} 청소비서 계정: {field(values, set, readOnly, 'pgAccountId')}</p>
      <p>이 신청은 주식회사 서비스브릿지(대표자 이정무)에게 합니다.</p>
      <h2>이용계약</h2>
      <p>가맹점과 주식회사 서비스브릿지(이하 “회사”)는 회사가 운영하는 청소비서의 카드결제 이용에 관하여 다음과 같이 계약합니다.</p>
      <h2>제1조 (목적)</h2>
      <p>이 계약은 가맹점이 청소비서를 통해 국내 신용카드 결제를 이용하는 조건과, 회사·가맹점의 권리 의무를 정합니다.</p>
      <h2>제2조 (당사자와 역할)</h2>
    </ContractSheet>
  );
}

export function ContractPage5({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={5} contractNo={contractNo}>
      <p>① 이 계약의 당사자는 가맹점과 회사(주식회사 서비스브릿지, 대표자 이정무, 사업자등록번호 138-87-04035)입니다. 이 약관은 회사가 작성합니다.</p>
      <p>② 주식회사 원성페이먼츠는 이 계약의 서명 당사자가 아닙니다. 카드 승인, 매입, 정산, 지급보류, 거래취소의 집행 등 전자지급결제대행은 결제대행사가 전자금융거래법령에 따라 자신의 명의와 책임으로 합니다. 회사는 체결된 전자계약서를 결제대행사 심사에 제출합니다.</p>
      <p>③ 회사는 가맹점의 신청을 받아 결제대행사에 전달하고, 청소비서에서 결제대행사의 결제창 또는 결제대행사가 허용한 수기결제 화면으로 연결합니다. 회사는 전자지급결제대행업을 영위하지 않으며, 카드번호를 수집하거나 저장하지 않습니다.</p>
      <p>④ 가맹 심사, 승인한도, 정산 계좌로의 대금 지급, 지급보류는 결제대행사와 카드사의 기준을 따릅니다. 결제대행사가 심사를 거절하거나 대금을 보류·지연해도, 회사의 고의 또는 중과실이 아닌 한 회사는 그 대금을 대신 지급하지 않습니다.</p>
      <p>⑤ 카드 매출의 가맹점 명의는 가맹점 본인입니다. 회사 명의로 가맹점의 청소 매출을 일으켜서는 안 됩니다.</p>
      <p>⑥ 전자지급결제대행 자체의 조건에 관하여 가맹점이 결제대행사에 따로 제출한 약관·신청이 있으면 그 업무에 관하여 그 서류가 우선합니다. 이 계약은 청소비서 연동과 회사·가맹점 사이의 권리 의무에 적용됩니다.</p>
      <h2>제3조 (용어)</h2>
      <p>“이용자”는 가맹점의 청소 용역을 카드로 결제하는 고객입니다.</p>
      <p>“비정상거래”는 분실·도난·도용·위조된 결제수단으로 이뤄진 거래, 현금을 마련하려는 거래, 용역 제공 없이 결제한 거래, 가맹점이 정상 제공을 증명하지 못한 거래를 말합니다.</p>
      <p>“거래정보”는 결제 건의 당사자, 금액, 일시, 용역 내용, 배송·완료를 확인할 수 있는 자료입니다.</p>
      <h2>제4조 (계약이 성립하는 때)</h2>
      <p>① 가맹점의 대표자 또는 계약 권한이 있는 관리자가 청소비서 화면에서 이 약관에 동의하고 전자서명하면 청약이 됩니다. 인감 날인과 같은 효력으로 봅니다. 회사가 서류를 확인하고 결제대행사가 가맹 심사를 승인하면 카드결제를 쓸 수 있습니다.</p>
      <p>② 타인 명의를 빌리거나 거짓으로 성립한 계약은 무효이고, 그 손해는 가맹점이 부담합니다.</p>
      <p>③ 심사 전에 결제를 미리 열어 주는 절차는 두지 않습니다.</p>
      <p>④ 회사가 접수를 보류할 수 있는 경우: 기재가 빠지거나 틀린 때, 보증 등 결제대행사가 요구한 서류를 내지 않은 때, 보완이 필요한 때. 사유가 해소되면 회사는 지체 없이 다시 접수합니다.</p>
      <p>⑤ 회사 또는 결제대행사가 거절할 수 있는 경우: 입점할 수 없는 업종, 실명이 아닌 신청, 거짓 서류, 법령이나 카드사 정책에 명백히 어긋나는 영업.</p>
      <h2>제5조 (서비스 범위)</h2>
    </ContractSheet>
  );
}

export function ContractPage6({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={6} contractNo={contractNo}>
      <p>① 회사는 가맹점이 청소비서에서 국내 신용카드 결제를 시작하도록 화면과 연동, 신청 상태 안내, 기술 문의를 제공합니다.</p>
      <p>② 결제창은 연중 결제대행사 시스템 가동 시간을 따릅니다. 정기점검은 결제대행사 또는 회사가 알 수 있는 때에 미리 알립니다. 천재지변, 카드사·결제대행사 장애는 예외입니다.</p>
      <p>③ 결제대행사 모듈과 화면은 결제대행사의 것입니다. 가맹점은 이를 수정·양도·담보로 제공하거나 신청한 용도 밖으로 쓰지 않습니다. 카드번호 등 결제정보를 결제 승인 뒤에 따로 저장하거나 대신 입력하지 않습니다.</p>
      <h2>제6조 (수수료)</h2>
      <p>① 가맹점은 신청서의 수수료를 부담합니다. 수수료에는 결제대행사의 원가와 회사의 플랫폼 이용료가 함께 포함될 수 있으며, 정산 때 결제대금에서 공제하는 것을 원칙으로 합니다.</p>
      <p>② 신용카드에 관하여 가맹점이 여신전문금융업법 제18조의3의 영세·중소가맹점이면, 카드사 원가가 반기마다 바뀌는 만큼 신청서의 우대 수수료도 바뀔 수 있습니다. 바뀐 율은 청소비서 화면 또는 이메일로 확인할 수 있습니다.</p>
      <p>③ 결제대행사와 카드사 사이의 원가·정산일이 바뀌거나, 월 승인액·비정상거래·민원이 늘어 수수료 조정이 필요하면, 회사는 이메일 또는 청소비서 화면으로 알린 뒤 수수료 또는 정산일을 바꿀 수 있습니다.</p>
      <h2>제7조 (정산)</h2>
      <p>① 결제대행사는 약정한 정산일에, 정상 거래의 승인금액에서 취소금액을 뺀 뒤 수수료를 공제하고 가맹점의 정산 계좌로 지급합니다.</p>
      <p>② 수수료에 대한 세금계산서는 회사가 부담하는 이용료 부분과 결제대행사가 부담하는 부분을 나누어, 각각의 공급자가 법령에 맞게 발행합니다. 한 쪽이 전부 대행 발행하는 구조이면 그 사실을 가맹점에 알립니다.</p>
      <p>③ 취소·차감은 다음 정산금에서 빼는 것을 원칙으로 합니다. 모자라면 가맹점은 결제대행사가 알린 방법으로 돌려줍니다.</p>
      <p>④ 정산금이 잘못 오간 사실을 확인한 날부터 영업일 2일 안에 서로 알리고 바로잡습니다. 숫자가 다르면 결제대행사·카드사 자료를 기준으로 합니다.</p>
      <p>⑤ 정산 계좌를 바꾸려면 영업일 7일 전에 회사에 알리고 결제대행사의 확인을 받습니다. 알리지 않아 생긴 오입금은 가맹점이 부담합니다.</p>
      <p>⑥ 가맹점은 회사와 결제대행사의 동의 없이 정산금을 양도하여 회사와 결제대행사에 맞설 수 없습니다.</p>
      <p>⑦ 카드사·결제대행사 사정으로 입금이 늦어지거나 불가하면, 회사의 고의 또는 중과실이 아닌 한 회사는 그 금액을 대신 지급하지 않습니다.</p>
      <p>⑧ 계약이 끝난 뒤에도, 이미 승인된 건은 용역 제공이 확인될 때까지 결제대행사가 정산을 보류할 수 있습니다. 가맹점이 제공 사실을 증명하면 결제대행사는 그 기준에 따라 지급합니다.</p>
    </ContractSheet>
  );
}
