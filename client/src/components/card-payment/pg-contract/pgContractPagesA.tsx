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

export function ContractPage1({ values, set, readOnly, contractNo }: PageProps) {
  return (
    <ContractSheet page={1} contractNo={contractNo}>
      <p className="pg-center pg-muted">주식회사 서비스브릿지</p>
      <h1 className="pg-center">청소비서 카드결제 서비스<br />이용신청서 및 이용계약서</h1>
      <p className="pg-center pg-muted">전자계약용 이용약관</p>
      <p>이 약관은 주식회사 서비스브릿지가 작성한 계약입니다. 가맹점은 청소비서 화면에서 전자서명으로 체결합니다. 법인인감·대표자 인감은 받지 않습니다. 체결된 계약서는 회사가 협력 결제대행사 주식회사 원성페이먼츠(SunshinePay)에 제출하고, 결제대행사가 심사합니다. 결제대행사는 이 계약의 서명 당사자가 아닙니다.</p>
      <p>카드 승인·매입·정산은 결제대행사가 합니다. 회사는 전자지급결제대행업자가 아니며, 심사가 끝나기 전에는 카드결제를 쓸 수 없습니다.</p>
      <h2>계약 회사</h2>
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
          <tr><th>본점</th><td colSpan={3}>인천광역시 연수구 송도미래로 30, 이동 801호, 엠46(송도동, 스마트밸리지식산업센터)</td></tr>
          <tr><th>업태</th><td colSpan={3}>정보통신업, 도매 및 소매업, 전문·과학 및 기술서비스업, 사업시설 관리·사업지원 및 임대서비스업</td></tr>
          <tr><th>종목</th><td colSpan={3}>응용 소프트웨어 개발 및 공급업, 전자상거래 소매업, 시스템 소프트웨어 개발 및 공급업, 자료 처리업, 광고 대행업, 건축물 일반 청소업</td></tr>
          <tr><th>세금계산서</th><td colSpan={3}>tax@service-bridges.com</td></tr>
          <tr><th>계약 통지</th><td colSpan={3}>cbiseo@service-bridges.com 또는 청소비서 화면</td></tr>
        </tbody>
      </table>
      <h2>1. 가맹점 기본 정보</h2>
      <table className="pg-table">
        <tbody>
          <tr>
            <th>구분</th>
            <td>
              <Choice on={v(values, 'pgBizKind') === 'solo'} label="개인사업자" readOnly={readOnly} onPick={() => set('pgBizKind', 'solo')} />
              <Choice on={v(values, 'pgBizKind') === 'corp'} label="법인" readOnly={readOnly} onPick={() => set('pgBizKind', 'corp')} />
            </td>
            <th>과세</th>
            <td>
              <Choice on={v(values, 'pgTaxKind') === 'tax'} label="과세" readOnly={readOnly} onPick={() => set('pgTaxKind', 'tax')} />
              <Choice on={v(values, 'pgTaxKind') === 'exempt'} label="면세" readOnly={readOnly} onPick={() => set('pgTaxKind', 'exempt')} />
            </td>
          </tr>
          <tr><th>상호</th><td colSpan={3}><Blank width="70mm" value={v(values, '[[EC_MERCHANT_NAME]]')} readOnly={readOnly} onChange={(next) => set('[[EC_MERCHANT_NAME]]', next)} /></td></tr>
          <tr><th>사업자등록번호</th><td colSpan={3}><Blank width="50mm" value={v(values, '[[EC_BIZ_NO]]')} readOnly={readOnly} onChange={(next) => set('[[EC_BIZ_NO]]', next)} /></td></tr>
          <tr><th>대표자</th><td><Blank value={v(values, '[[EC_SIGNER_NAME]]')} readOnly={readOnly} onChange={(next) => set('[[EC_SIGNER_NAME]]', next)} /></td><th>휴대폰</th><td><Blank value={v(values, '[[EC_SIGNER_PHONE]]')} readOnly={readOnly} onChange={(next) => set('[[EC_SIGNER_PHONE]]', next)} /></td></tr>
          <tr><th>사업장 주소</th><td colSpan={3}><Blank width="110mm" value={v(values, '[[EC_SIGNER_ADDRESS]]')} readOnly={readOnly} onChange={(next) => set('[[EC_SIGNER_ADDRESS]]', next)} /></td></tr>
          <tr><th>주요 판매 용역</th><td colSpan={3}>입주청소, 거주청소 등 청소와 직접 관련된 용역</td></tr>
        </tbody>
      </table>
    </ContractSheet>
  );
}

export function ContractPage2({ values, set, readOnly, contractNo }: PageProps) {
  return (
    <ContractSheet page={2} contractNo={contractNo}>
      <h2>2. 담당자</h2>
      <table className="pg-table">
        <tbody>
          <tr><th>계약 담당</th><td>이름 <Blank value={v(values, 'pgStaffName')} readOnly={readOnly} onChange={(next) => set('pgStaffName', next)} /> 전화 <Blank value={v(values, 'pgStaffPhone')} readOnly={readOnly} onChange={(next) => set('pgStaffPhone', next)} /></td></tr>
          <tr><th>정산 담당</th><td>이름 <Blank value={v(values, 'pgSettleName')} readOnly={readOnly} onChange={(next) => set('pgSettleName', next)} /> 메일 <Blank width="46mm" value={v(values, 'pgSettleMail')} readOnly={readOnly} onChange={(next) => set('pgSettleMail', next)} /></td></tr>
        </tbody>
      </table>
      <h2>3. 정산 계좌</h2>
      <p>카드 결제대금은 결제대행사가 아래 계좌로 정산합니다. 예금주는 대표자 또는 상호와 같아야 합니다.</p>
      <table className="pg-table">
        <tbody>
          <tr><th>은행</th><td><Blank value={v(values, 'pgBank')} readOnly={readOnly} onChange={(next) => set('pgBank', next)} /></td></tr>
          <tr><th>계좌번호</th><td><Blank width="60mm" value={v(values, 'pgAccount')} readOnly={readOnly} onChange={(next) => set('pgAccount', next)} /></td></tr>
          <tr><th>예금주</th><td><Blank value={v(values, 'pgHolder')} readOnly={readOnly} onChange={(next) => set('pgHolder', next)} /></td></tr>
        </tbody>
      </table>
      <p className="pg-muted">등록비, 연관리비, 보증보험은 결제대행사가 요구할 때만 가맹점이 부담합니다. 회사는 정산금에서 임의로 빼지 않습니다.</p>
      <h2>4. 수수료와 정산일</h2>
      <LockFee />
      <h2>5. 판매 범위</h2>
      <p>가맹점이 이 결제로 받는 돈은 신청서에 적은 청소 및 이와 직접 관련된 용역의 대가여야 합니다. 상품권, 기프티콘, 포인트·게임머니 충전, 선불충전은 받지 않습니다.</p>
      <p>업종이나 판매 용역을 바꾸려면 미리 회사에 알리고, 결제대행사 심사를 다시 받아야 합니다.</p>
    </ContractSheet>
  );
}

export function ContractPage3({ values, set, readOnly, contractNo }: PageProps) {
  const ad = (key: string) => v(values, key) === 'Y';
  return (
    <ContractSheet page={3} contractNo={contractNo}>
      <h2>6. 제출 서류</h2>
      <p>필수: 이 신청서 및 이용계약서, 사업자등록증 사본, 정산 통장 사본, 실제 소유자 확인서.</p>
      <p>개인사업자는 대표자 신분증 사본, 법인은 법인등기사항증명서(발급 3개월 이내)를 냅니다. 회사는 법령 근거 없이 주민등록번호 뒷자리를 받지 않습니다.</p>
      <h2>7. 개인정보 — 가. 수집·이용 (필수)</h2>
      <p>수집하는 곳: 주식회사 서비스브릿지. 항목은 상호, 사업자등록번호, 대표자·담당자 연락처, 정산계좌, 실제 소유자, 정산·민원에 필요한 거래내역입니다. 목적은 신청 접수, 본인 확인, 결제대행사 심사, 결제 화면 연결, 정산 안내, 부정 이용 방지입니다. 전자금융 거래기록은 법령상 기간(원칙 5년)까지 둡니다.</p>
      <p>동의하지 않으면 카드결제를 열 수 없습니다.</p>
      <p>
        <Choice on={isChecked(v(values, 'pgPrivacy'))} label="동의함" readOnly={readOnly} onPick={() => set('pgPrivacy', 'Y')} />
        <Choice on={v(values, 'pgPrivacy') === 'N'} label="동의하지 않음" readOnly={readOnly} onPick={() => set('pgPrivacy', 'N')} />
      </p>
      <h2>나. 제3자 제공 (필수)</h2>
      <p>제공받는 자: 주식회사 원성페이먼츠. 가맹 심사와 승인·매입을 위해 해당 카드사에 대표자 이름, 생년월일, 사업자 정보를 제공합니다. 동의하지 않으면 심사를 진행할 수 없습니다.</p>
      <p>
        <Choice on={isChecked(v(values, 'pgShare'))} label="동의함" readOnly={readOnly} onPick={() => set('pgShare', 'Y')} />
        <Choice on={v(values, 'pgShare') === 'N'} label="동의하지 않음" readOnly={readOnly} onPick={() => set('pgShare', 'N')} />
      </p>
      <h2>다. 처리 위탁 · 라. 광고 수신</h2>
      <p>회사는 카드 승인·매입·정산 연동을 주식회사 원성페이먼츠에 위탁합니다. 카드번호는 회사 화면에 입력하지 않습니다. 광고 수신은 선택이며, 거부해도 카드결제 이용에는 불이익이 없습니다.</p>
      <p>
        <Choice on={ad('pgAdEmail')} label="이메일" readOnly={readOnly} onPick={() => set('pgAdEmail', ad('pgAdEmail') ? '' : 'Y')} />
        <Choice on={ad('pgAdSms')} label="문자" readOnly={readOnly} onPick={() => set('pgAdSms', ad('pgAdSms') ? '' : 'Y')} />
        <Choice on={ad('pgAdNone')} label="받지 않음" readOnly={readOnly} onPick={() => { set('pgAdNone', 'Y'); set('pgAdEmail', ''); set('pgAdSms', ''); }} />
      </p>
    </ContractSheet>
  );
}

export function ContractPage4({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={4} contractNo={contractNo}>
      <h2>8. 전자서명으로 신청</h2>
      <p>대표자 또는 계약 권한이 있는 관리자가 청소비서에서 이 약관에 동의하고 전자서명하면 이용계약 체결을 신청한 것으로 봅니다. 인감 날인은 하지 않습니다. 이 신청은 주식회사 서비스브릿지(대표자 이정무)에게 합니다.</p>
      <h2>이용계약</h2>
      <p>가맹점과 주식회사 서비스브릿지(이하 “회사”)는 청소비서의 카드결제 이용에 관하여 다음과 같이 계약합니다.</p>
      <h2>제1조 (목적)</h2>
      <p>이 계약은 가맹점이 청소비서를 통해 국내 신용카드 결제를 이용하는 조건과, 회사·가맹점의 권리 의무를 정합니다.</p>
      <h2>제2조 (당사자와 역할)</h2>
      <p>① 당사자는 가맹점과 회사(주식회사 서비스브릿지, 대표자 이정무, 사업자등록번호 138-87-04035)입니다.</p>
      <p>② 주식회사 원성페이먼츠는 서명 당사자가 아닙니다. 승인·매입·정산·지급보류는 결제대행사가 자신의 명의와 책임으로 합니다.</p>
      <p>③ 회사는 전자지급결제대행업을 영위하지 않으며 카드번호를 수집하거나 저장하지 않습니다.</p>
      <p>④ 심사 거절이나 대금 보류에 대해, 회사의 고의 또는 중과실이 아닌 한 회사는 그 대금을 대신 지급하지 않습니다.</p>
      <p>⑤ 카드 매출의 가맹점 명의는 가맹점 본인입니다.</p>
      <h2>제3조 (용어)</h2>
      <p>“이용자”는 가맹점의 청소 용역을 카드로 결제하는 고객입니다. “비정상거래”는 분실·도난·도용 카드, 현금화, 용역 제공 없는 결제, 가맹점이 제공을 증명하지 못한 거래입니다.</p>
      <h2>제4조 (계약이 성립하는 때)</h2>
      <p>① 전자서명으로 청약하고, 회사가 서류를 확인하며 결제대행사가 가맹 심사를 승인하면 카드결제를 쓸 수 있습니다. 심사 전 선결제는 없습니다.</p>
      <p>② 타인 명의나 거짓 서류로 성립한 계약은 무효입니다. 기재 누락·보증 미비는 보류하고, 입점 불가 업종·실명이 아닌 신청은 거절할 수 있습니다.</p>
      <h2>제5조 (서비스 범위)</h2>
      <p>회사는 결제 화면 연동, 신청 상태 안내, 기술 문의를 제공합니다. 가맹점은 결제 모듈을 수정하거나 카드번호를 승인 뒤에 저장하지 않습니다.</p>
      <h2>제6조 (수수료)</h2>
      <p>가맹점은 앞쪽 신청서의 수수료 3.3%(부가세 별도)를 부담합니다. 정산 때 결제대금에서 공제하는 것을 원칙으로 합니다. 영세·중소 우대와 카드사 원가가 바뀌면 회사는 화면 또는 이메일로 알립니다.</p>
    </ContractSheet>
  );
}
