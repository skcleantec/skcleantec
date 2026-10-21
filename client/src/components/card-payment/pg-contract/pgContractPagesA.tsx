import { Blank, Choice, LockFee, isChecked, type ContractValues, type FlowBlock, type PageProps } from './pgContractChrome';

const SEAL = '/brand/service-bridge-seal.png';

function v(values: ContractValues, key: string) {
  return values[key] ?? '';
}

function field(values: ContractValues, set: PageProps['set'], readOnly: boolean, key: string, width = '36mm') {
  return <Blank width={width} value={v(values, key)} readOnly={readOnly} onChange={(next) => set(key, next)} />;
}

function block(key: string, label: string, node: FlowBlock['node'], gate?: FlowBlock['gate']): FlowBlock {
  return { key, label, node, gate };
}

export function contractBlocksA({ values, set, readOnly }: PageProps): FlowBlock[] {
  const f = (key: string, width?: string) => field(values, set, readOnly, key, width);
  const ad = (key: string) => v(values, key) === 'Y';
  const kind = v(values, 'pgBizKind');
  return [
    block(
      'intro',
      '신청서',
      <>
        <p className="pg-center">주식회사 서비스브릿지</p>
        <h1 className="pg-center">청소비서 카드결제 서비스 이용신청서 및 이용계약서</h1>
        <p className="pg-center pg-muted">전자계약용 이용약관</p>
        <p>이 약관은 주식회사 서비스브릿지가 작성한 계약입니다. 가맹점은 청소비서 화면에서 전자서명으로 체결합니다. 계약서에 인감을 날인하지 않습니다. 체결된 계약서는 회사가 협력 결제대행사 주식회사 원성페이먼츠(SunshinePay)에 제출하고, 결제대행사가 심사합니다. 결제대행사는 이 계약의 서명 당사자가 아닙니다.</p>
        <p>카드 승인·매입·정산은 결제대행사가 합니다. 회사는 전자지급결제대행업자가 아니며, 심사가 끝나기 전에는 카드결제를 쓸 수 없습니다. 「청소비서」는 아래 회사가 운영하는 청소업체용 업무 플랫폼입니다.</p>
      </>,
    ),
    block(
      'company',
      '계약 회사',
      <>
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
            <tr><th>본점 · 사업장</th><td colSpan={3}>인천광역시 연수구 송도미래로 30, 이동 801호, 엠46(송도동, 스마트밸리지식산업센터)</td></tr>
            <tr><th>업태</th><td colSpan={3}>정보통신업, 도매 및 소매업, 전문·과학 및 기술서비스업, 사업시설 관리·사업지원 및 임대서비스업</td></tr>
            <tr><th>종목</th><td colSpan={3}>응용 소프트웨어 개발 및 공급업, 전자상거래 소매업, 시스템 소프트웨어 개발 및 공급업, 자료 처리업, 광고 대행업, 건축물 일반 청소업</td></tr>
            <tr><th>세금계산서 · 통지</th><td colSpan={3}>tax@service-bridges.com · cbiseo@service-bridges.com 또는 청소비서 화면</td></tr>
          </tbody>
        </table>
      </>,
    ),
    block(
      'merchant',
      '가맹점',
      <>
        <h2>1. 가맹점</h2>
        <p>
          구분
          <Choice on={v(values, 'pgBizKind') === 'solo'} label="개인사업자" readOnly={readOnly} onPick={() => set('pgBizKind', 'solo')} />
          <Choice on={v(values, 'pgBizKind') === 'corp'} label="법인" readOnly={readOnly} onPick={() => set('pgBizKind', 'corp')} />
          과세
          <Choice on={v(values, 'pgTaxKind') === 'tax'} label="과세" readOnly={readOnly} onPick={() => set('pgTaxKind', 'tax')} />
          <Choice on={v(values, 'pgTaxKind') === 'exempt'} label="면세" readOnly={readOnly} onPick={() => set('pgTaxKind', 'exempt')} />
          <span className="pg-muted">공동대표이면 대표자 전원을 적습니다.</span>
        </p>
        <table className="pg-table">
          <tbody>
            <tr><th>상호</th><td>{f('[[EC_MERCHANT_NAME]]', '70mm')}</td><th>사업자번호</th><td>{f('[[EC_BIZ_NO]]')}</td></tr>
            {kind === 'corp' ? (
              <tr><th>법인번호</th><td>{f('pgCorpNo')}</td><th>대표자</th><td>{f('[[EC_SIGNER_NAME]]')}</td></tr>
            ) : (
              <tr><th>대표자</th><td colSpan={3}>{f('[[EC_SIGNER_NAME]]')}</td></tr>
            )}
            <tr><th>생년월일</th><td>{f('pgBirth')}</td><th>휴대폰</th><td>{f('[[EC_SIGNER_PHONE]]')}</td></tr>
            <tr><th>대표 전화</th><td>{f('pgTel')}</td><th>업태·종목</th><td>{f('pgBizType', '22mm')} {f('pgBizItem', '22mm')}</td></tr>
            <tr><th>판매 용역</th><td colSpan={3}>{f('pgService', '90mm')} <span className="pg-muted">입주청소, 거주청소 등</span></td></tr>
            <tr><th>사업장</th><td colSpan={3}>{f('[[EC_SIGNER_ADDRESS]]', '120mm')}</td></tr>
            <tr><th>우편물</th><td>{f('pgMailAddr')} <span className="pg-muted">같으면 상동</span></td><th>업체</th><td>{f('pgTenantCode')}</td></tr>
          </tbody>
        </table>
      </>,
      'identity',
    ),
    block(
      'staff',
      '담당자 · 정산',
      <>
        <h2>2. 담당자 · 3. 정산 계좌</h2>
        <p>계약 담당 {f('pgStaffName', '24mm')} {f('pgStaffPhone', '28mm')} {f('pgStaffMail', '40mm')}</p>
        <p>정산 담당 {f('pgSettleName', '24mm')} {f('pgSettlePhone', '28mm')} {f('pgSettleMail', '40mm')}</p>
        <p>은행 {f('pgBank', '22mm')} 계좌 {f('pgAccount', '42mm')} 예금주 {f('pgHolder', '28mm')}. 예금주는 대표자 또는 상호와 같아야 합니다. 담보는 결제대행사가 요구할 때만 가맹점이 부담하고, 회사는 정산금에서 임의로 빼지 않습니다.</p>
      </>,
    ),
    block(
      'fee',
      '수수료',
      <>
        <h2>4. 수수료와 정산일</h2>
        <LockFee />
        <p>여신전문금융업법 제18조의3에 따라 가맹점의 영세·중소 여부는 국세청 매출을 기준으로 반기마다 다시 매겨집니다. 카드사 원가가 바뀌면 위 수수료도 바뀔 수 있습니다. 회사는 청소비서 화면 또는 이메일로 알립니다.</p>
      </>,
    ),
    block(
      'sales',
      '판매 범위',
      <>
        <h2>5. 판매 범위</h2>
        <p>가맹점이 이 결제로 받는 돈은 신청서에 적은 청소 및 이와 직접 관련된 용역의 대가여야 합니다. 상품권, 기프티콘, 포인트·게임머니 충전, 선불충전은 받지 않습니다. 결제대행사가 예외를 서면으로 허용한 경우만 가능하고, 그때는 결제대행사가 정한 추가 본인확인을 적용합니다. 법령, 카드사, 결제대행사가 받지 못하게 한 업종·품목은 부속서의 기준을 따릅니다. 업종이나 판매 용역을 바꾸려면 미리 회사에 알리고, 결제대행사 심사를 다시 받아야 합니다.</p>
      </>,
    ),
    block(
      'docs',
      '제출 서류',
      <>
        <h2>6. 제출 서류</h2>
        {kind === 'solo' ? (
          <p>개인사업자는 가맹 신청 화면에서 사업자등록증, 통장사본, 신분증을 올립니다. 이 세 가지는 우편으로 보내지 않습니다. 회사는 법령 근거 없이 주민등록번호 뒷자리를 받지 않습니다.</p>
        ) : kind === 'corp' ? (
          <p>법인사업자는 사업자등록증, 통장사본, 법인인감, 법인등기부를 우편으로 주식회사 원성페이먼츠 본사에 보냅니다. 이 화면에는 올리지 않습니다. 법인등기사항증명서는 발급 3개월 이내입니다. 회사는 법령 근거 없이 주민등록번호 뒷자리를 받지 않습니다.</p>
        ) : (
          <p>위에서 개인사업자 또는 법인을 고르면, 그 구분에 필요한 서류만 여기와 맨 아래에 나옵니다.</p>
        )}
      </>,
    ),
    block(
      'privacy',
      '개인정보',
      <>
        <h2>7. 개인정보 — 가. 수집·이용 (필수)</h2>
        <p>수집하는 곳: 주식회사 서비스브릿지. 결제대행사가 심사·정산을 위해 같은 항목을 다시 수집·이용할 수 있습니다. 항목: 상호, 사업자등록번호, 대표자 이름·생년월일·성별·국적·전화번호, 담당자 이름·전화·이메일, 정산계좌, 실제 소유자 정보, 거래내역. 목적: 신청 접수, 본인·사업자 확인, 심사 요청, 결제 화면 연결, 정산·수수료 안내, 민원 전달, 부정 이용 방지, 법령상 의무. 보유: 목적 달성 후 지체 없이 파기합니다. 전자금융거래법 등에서 거래기록을 보존하도록 한 기간(원칙 5년)은 그 기간까지 둡니다. 동의하지 않으면 카드결제를 열 수 없습니다.</p>
        <p>
          <Choice on={isChecked(v(values, 'pgPrivacy'))} label="동의함" readOnly={readOnly} onPick={() => set('pgPrivacy', 'Y')} />
          <Choice on={v(values, 'pgPrivacy') === 'N'} label="동의하지 않음" readOnly={readOnly} onPick={() => set('pgPrivacy', 'N')} />
        </p>
      </>,
      'privacy',
    ),
    block(
      'share',
      '제3자 제공',
      <>
        <h2>나. 제3자 제공 (필수)</h2>
        <p>제공받는 자: 주식회사 원성페이먼츠. 원성페이먼츠는 가맹 심사와 승인·매입을 위해 카드사(국민, 비씨, 롯데, 삼성, 현대, 신한, 하나, NH농협 등)에 대표자 이름, 생년월일, 사업자 정보와 심사에 필요한 항목을 제공합니다. 목적: 가맹 심사, 거래 승인·매입·정산, 본인확인, 민원·부정거래 확인, 특정금융정보법에 따른 확인. 보유: 제공 목적 달성 시 파기. 법령에 보존 기간이 있으면 그 기간. 동의하지 않으면 심사를 진행할 수 없습니다.</p>
        <p>
          <Choice on={isChecked(v(values, 'pgShare'))} label="동의함" readOnly={readOnly} onPick={() => set('pgShare', 'Y')} />
          <Choice on={v(values, 'pgShare') === 'N'} label="동의하지 않음" readOnly={readOnly} onPick={() => set('pgShare', 'N')} />
        </p>
      </>,
      'share',
    ),
    block(
      'ads',
      '위탁 · 광고',
      <>
        <h2>다. 위탁 · 라. 광고 수신 (선택)</h2>
        <p>회사는 카드 승인·매입·정산 시스템 연동을 주식회사 원성페이먼츠에 위탁합니다. 카드번호, 유효기간, 비밀번호는 회사 화면에 입력하지 않으며 결제대행사 화면에서만 처리됩니다. 회사와 가맹점은 이를 저장하지 않습니다. 회사(서비스브릿지)가 청소비서 안내를 이메일 또는 문자로 보낼 수 있습니다. 거부해도 카드결제 이용에는 불이익이 없습니다.</p>
        <p>
          <Choice on={ad('pgAdEmail')} label="이메일 수신" readOnly={readOnly} onPick={() => set('pgAdEmail', ad('pgAdEmail') ? '' : 'Y')} />
          <Choice on={ad('pgAdSms')} label="문자 수신" readOnly={readOnly} onPick={() => set('pgAdSms', ad('pgAdSms') ? '' : 'Y')} />
          <Choice on={ad('pgAdNone')} label="받지 않음" readOnly={readOnly} onPick={() => { set('pgAdNone', 'Y'); set('pgAdEmail', ''); set('pgAdSms', ''); }} />
        </p>
      </>,
    ),
    block(
      'apply',
      '이용계약',
      <>
        <h2>8. 전자서명으로 신청 · 이용계약</h2>
        <p>가맹점의 대표자 또는 계약 권한이 있는 관리자가 청소비서에서 이 약관에 동의하고 전자서명하면, 이용계약 체결을 신청한 것으로 봅니다. 인감 날인은 하지 않습니다. 이 신청은 주식회사 서비스브릿지(대표자 이정무)에게 합니다. 가맹점과 회사는 청소비서의 카드결제 이용에 관하여 다음과 같이 계약합니다.</p>
      </>,
    ),
    block(
      'art12',
      '제1조 · 제2조',
      <>
        <h2>제1조 (목적) · 제2조 (당사자와 역할)</h2>
        <p>이 계약은 가맹점이 청소비서를 통해 국내 신용카드 결제를 이용하는 조건과, 회사·가맹점의 권리 의무를 정합니다. ① 당사자는 가맹점과 회사(주식회사 서비스브릿지, 대표자 이정무, 138-87-04035)입니다. ② 주식회사 원성페이먼츠는 서명 당사자가 아닙니다. 승인, 매입, 정산, 지급보류, 거래취소는 결제대행사가 자신의 명의와 책임으로 하고, 회사는 전자계약서를 심사에 제출합니다. ③ 회사는 신청을 전달하고 결제창 또는 허용된 수기결제 화면으로 연결합니다. 회사는 전자지급결제대행업을 영위하지 않으며 카드번호를 수집·저장하지 않습니다. ④ 심사, 한도, 대금 지급, 지급보류는 결제대행사와 카드사 기준입니다. 회사의 고의 또는 중과실이 아니면 그 대금을 대신 지급하지 않습니다. ⑤ 카드 매출의 명의는 가맹점 본인입니다. ⑥ 결제대행사에 따로 제출한 약관이 있으면 그 업무에는 그 서류가 우선하고, 이 계약은 청소비서 연동과 회사·가맹점 사이의 권리 의무에 적용됩니다.</p>
      </>,
    ),
    block(
      'art34',
      '제3조 · 제4조',
      <>
        <h2>제3조 (용어) · 제4조 (계약이 성립하는 때)</h2>
        <p>“이용자”는 가맹점의 청소 용역을 카드로 결제하는 고객입니다. “비정상거래”는 분실·도난·도용·위조된 결제수단, 현금을 마련하려는 거래, 용역 제공 없이 결제한 거래, 가맹점이 정상 제공을 증명하지 못한 거래입니다. “거래정보”는 당사자, 금액, 일시, 용역 내용, 완료를 확인할 수 있는 자료입니다. ① 화면에서 약관에 동의하고 전자서명하면 청약이고, 인감 날인과 같은 효력으로 봅니다. 결제대행사가 가맹 심사를 승인하면 카드결제를 쓸 수 있습니다. ② 타인 명의를 빌리거나 거짓으로 성립한 계약은 무효이고 손해는 가맹점이 부담합니다. ③ 심사 전에 결제를 미리 열지 않습니다. ④ 기재가 빠지거나 서류를 내지 않으면 접수를 보류하고, 해소되면 지체 없이 다시 접수합니다. ⑤ 입점할 수 없는 업종, 실명이 아닌 신청, 거짓 서류, 법령이나 카드사 정책에 어긋나는 영업이면 거절할 수 있습니다.</p>
      </>,
    ),
    block(
      'art56',
      '제5조 · 제6조',
      <>
        <h2>제5조 (서비스 범위) · 제6조 (수수료)</h2>
        <p>① 회사는 화면과 연동, 신청 상태 안내, 기술 문의를 제공합니다. ② 결제창은 결제대행사 가동 시간을 따르고, 정기점검은 알 수 있는 때에 미리 알립니다. 천재지변, 카드사·결제대행사 장애는 예외입니다. ③ 모듈과 화면은 결제대행사의 것입니다. 가맹점은 이를 수정·양도하거나 신청한 용도 밖으로 쓰지 않고, 카드번호를 승인 뒤에 따로 저장하지 않습니다. 가맹점은 신청서의 수수료를 부담합니다. 수수료에는 결제대행사 원가와 회사의 플랫폼 이용료가 함께 포함될 수 있고, 정산 때 공제합니다. 영세·중소가맹점이면 카드사 원가가 반기마다 바뀌는 만큼 우대 수수료도 바뀔 수 있습니다. 원가·정산일·민원으로 조정이 필요하면 이메일 또는 화면으로 알린 뒤 바꿀 수 있습니다.</p>
      </>,
    ),
    block(
      'art7',
      '제7조',
      <>
        <h2>제7조 (정산)</h2>
        <p>① 결제대행사는 정산일에 승인금액에서 취소를 빼고 수수료를 공제한 뒤 가맹점 계좌로 지급합니다. ② 세금계산서는 회사 이용료와 결제대행사 부분을 나누어 발행합니다. ③ 취소·차감은 다음 정산금에서 빼고, 모자라면 가맹점이 돌려줍니다. ④ 잘못 오간 금액은 확인한 날부터 영업일 2일 안에 바로잡습니다. ⑤ 계좌 변경은 영업일 7일 전에 알리고 확인을 받습니다. ⑥ 동의 없이 정산금을 양도하여 회사와 결제대행사에 맞설 수 없습니다. ⑦ 카드사 사정으로 입금이 늦어도 회사의 고의·중과실이 아니면 회사가 대신 지급하지 않습니다. ⑧ 계약이 끝난 뒤에도 용역 제공이 확인될 때까지 정산이 보류될 수 있습니다.</p>
      </>,
    ),
  ];
}
