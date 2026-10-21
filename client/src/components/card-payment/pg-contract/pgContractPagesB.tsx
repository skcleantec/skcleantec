import { Blank, Choice, ContractSheet, isChecked, type ContractValues } from './pgContractChrome';

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

function field(values: ContractValues, set: PageProps['set'], readOnly: boolean, key: string, width = '32mm') {
  return <Blank width={width} value={v(values, key)} readOnly={readOnly} onChange={(next) => set(key, next)} />;
}

export function ContractPage7({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={7} contractNo={contractNo}>
      <h2>제8조 (가맹점의 의무)</h2>
      <p>① 이용자가 결제 화면에서 대금 청구 명의와 가맹점을 알아볼 수 있게 합니다.</p>
      <p>② 거래가 본인 사용이고 실제 용역 제공인지는 가맹점이 확인합니다.</p>
      <p>③ 카드 결제라는 이유로 이용자를 거절하거나 불리하게 대하지 않습니다. 가맹점 수수료를 이용자에게 떠넘기지 않습니다.</p>
      <p>④ 용역 제공 없이 결제한 것처럼 꾸미거나, 실제보다 큰 금액으로 결제하거나, 다른 가맹점 이름으로 결제하거나, 가맹점 이름을 빌려 주거나, 카드결제를 대신 받아 주지 않습니다.</p>
      <p>⑤ 거래정보는 5년 이상 보관합니다. 회사, 결제대행사, 카드사, 수사기관, 감독기관이 법령에 따라 요구하면 영업일 3일 안에 냅니다. 내지 않아 생긴 손해는 가맹점이 부담합니다.</p>
      <p>⑥ 이용자 정보를 회사에 넘길 때는 이용자 동의를 받습니다.</p>
      <p>⑦ 전자상거래법 등 소비자 보호 법령의 가맹점 의무를 가맹점이 이행합니다. 결제대행 명의를 이유로 그 의무를 회사나 결제대행사에 넘기지 않습니다.</p>
      <h2>제9조 (금지 거래)</h2>
      <p>① 가맹점은 신청서에 적은 청소 및 직접 관련 용역만 이 결제로 받습니다.</p>
      <p>② 주류, 담배, 의약품, 성인용품, 사행성, 대출·현금화, 상품권 등 부속서와 카드사·결제대행사가 금지한 품목은 판매하지 않습니다.</p>
      <p>③ 위반 거래는 결제대행사가 취소할 수 있고, 회사는 연동을 멈출 수 있습니다. 그 손해는 가맹점이 부담합니다.</p>
      <h2>제10조 (비정상거래, 취소, 민원)</h2>
      <p>① 결제대행사 또는 카드사가 거래 확인을 요구하면 가맹점은 영업일 3일 안에 거래정보를 냅니다.</p>
      <p>② 이용자, 회사, 결제대행사, 카드사가 법령·카드사 규정·비정상거래를 이유로 취소를 요구하면 가맹점은 취소하고 대금을 돌립니다. 신용카드 취소 가능 기간은 카드사 기준(통상 승인일부터 1년 안)을 따릅니다.</p>
      <p>③ 가맹점이 영업일 7일 안에 정당한 취소를 처리하지 않으면 결제대행사가 직접 취소할 수 있습니다. 이미 정산된 금액은 다음 정산금에서 빼고, 없으면 가맹점에 청구합니다. 계약이 끝난 뒤에도 같습니다.</p>
      <p>④ 비정상거래, 미배송·미제공, 현금화, 허위 매출, 이용자 이의, 보전처분, 담보 미제공, 금지 용역 판매가 있으면 결제대행사는 정산금의 전부 또는 일부를 보류할 수 있습니다. 회사는 그 사실을 가맹점에 알리고 새 승인을 멈출 수 있습니다. 보류를 푸는 권한은 결제대행사에 있습니다.</p>
      <p>⑤ 민원은 가맹점이 해결합니다. 회사는 연락과 자료 전달에 협조합니다. 민원으로 회사 또는 결제대행사에 손해가 생기면 가맹점이 배상합니다.</p>
      <p>⑥ 분실·도난·위조·변조된 결제수단인 줄을 가맹점이 몰랐고 그 점에 고의·중과실이 없으면, 그 거래의 회수 책임은 경감될 수 있습니다. 고의·중과실이 없다는 점은 가맹점이 소명합니다.</p>
    </ContractSheet>
  );
}

export function ContractPage8({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={8} contractNo={contractNo}>
      <h2>제11조 (담보)</h2>
      <p>결제대행사가 한도·민원·할부를 이유로 보증보험, 예치, 정산금 유보를 요구하면 가맹점이 결제대행사에 제공합니다. 회사는 담보의 수익자가 아니고, 담보를 대신 제공하거나 보험료를 가맹점 돈으로 임의 납부하지 않습니다.</p>
      <h2>제12조 (한도)</h2>
      <p>승인한도와 할부 개월 수는 결제대행사가 업종, 담보, 민원, 비정상거래를 보고 정합니다. 한도 제한으로 생긴 영업 손실은 가맹점이 부담합니다.</p>
      <h2>제13조 (통지)</h2>
      <p>① 상호, 대표자, 주소, 연락처, 판매 용역, 정산 계좌가 바뀌면 가맹점은 지체 없이 회사에 알립니다. 알리지 않으면 회사의 통지는 마지막으로 안 연락처에 도달한 때 도달한 것으로 봅니다.</p>
      <p>② 회사는 수수료, 정산일, 서비스 중단처럼 가맹점에게 중요한 변경을 이메일 또는 청소비서 화면으로 알립니다. 카드사·결제대행사 정책이 갑자기 바뀐 때에는 안 뒤 지체 없이 알립니다.</p>
      <h2>제14조 (회사의 의무)</h2>
      <p>① 회사는 신청 접수, 결제 화면 연결, 장애·정책 변경의 전달을 성실히 합니다.</p>
      <p>② 회사 시스템의 하자로 가맹점 또는 이용자에게 손해가 생기면 회사가 통상 손해를 배상합니다. 결제대행사·카드사·통신망의 장애는 회사의 고의 또는 중과실이 아닌 한 회사의 배상 범위에서 제외합니다.</p>
      <h2>제15조 (개인정보와 비밀)</h2>
      <p>① 회사와 가맹점은 이 계약으로 알게 된 이용자 정보, 거래정보, 상대의 영업비밀을 법령과 이 계약에서 정한 제공 말고는 제3자에게 넘기지 않습니다.</p>
      <p>② 수사기관, 감독기관, 카드사, 세무관서가 법령에 따라 자료를 요구하면 예외입니다.</p>
      <p>③ 특정금융정보법상 가맹점 확인, 실제 소유자 확인, 금융정보분석원 보고는 결제대행사의 의무입니다. 가맹점은 확인에 필요한 자료를 내고, 회사는 그 자료를 결제대행사에 전달합니다. 자료를 거부하면 결제대행사가 거래를 거절·종료할 수 있습니다.</p>
      <h2>제16조 (기간, 중지, 해지)</h2>
      <p>① 기간은 카드결제를 쓸 수 있게 된 날부터 1년입니다. 끝나기 1개월 전까지 어느 쪽이든 이메일 등 서면으로 끝낸다는 뜻이 없으면 같은 조건으로 1년씩 이어집니다. 청소비서 회원 자격이 끝나면 이 계약도 끝납니다.</p>
      <p>② 상대가 이 계약을 위반하면 14일 이상의 시정 기간을 주고, 시정되지 않으면 해지할 수 있습니다.</p>
      <p>③ 다음이면 시정 기간 없이 회사는 연동을 멈추거나 계약을 끝낼 수 있습니다. 결제대행사의 가맹 해지·심사 취소, 거짓 신청, 금지 용역 판매, 연락 두절, 영업이 실제로 멈춘 때, 민원이 반복되어 결제대행사가 거래를 제한한 때, 파산·회생·부도 등으로 영업을 계속하기 어려운 때.</p>
    </ContractSheet>
  );
}

export function ContractPage9({ values, set, readOnly, contractNo }: PageProps) {
  const seal = v(values, '[[EC_SEAL]]');
  const sign = v(values, '[[EC_SIGNATURE]]');
  return (
    <ContractSheet page={9} contractNo={contractNo}>
      <p>④ 가맹점이 잠시 멈추려면 미리 회사에 알리고, 그 기간의 취소·민원을 어떻게 처리할지 정합니다.</p>
      <p>⑤ 계약이 끝나도 이미 발생한 거래의 취소, 민원, 정산, 손해배상, 비밀, 개인정보 조항은 그 사유가 없어질 때까지 남습니다.</p>
      <h2>제17조 (계약상 지위의 이전)</h2>
      <p>합병, 영업양도, 법인 전환처럼 계약상 지위가 바뀌면 30일 전에 상대에게 알리고 동의를 받습니다. 개인사업자의 대표자 또는 사업자등록번호가 바뀌면 결제대행사 기준으로 신규 심사일 수 있습니다.</p>
      <h2>제18조 (손해배상)</h2>
      <p>이 계약을 어겨 상대에게 손해를 입히면 귀책 있는 쪽이 통상 손해를 배상합니다. 분쟁 해결에 든 합리적인 비용도 같습니다.</p>
      <h2>제19조 (정하지 않은 사항)</h2>
      <p>이 계약에 없는 사항은 전자금융거래법, 여신전문금융업법, 전자상거래법, 개인정보 보호법, 특정금융정보법과 카드사 가맹 규정을 따릅니다. 체크카드와 직불카드는 신용카드 규정을 같이 적용합니다.</p>
      <h2>제20조 (분쟁)</h2>
      <p>분쟁은 서로 협의하고, 협의가 되지 않으면 회사 본점(인천광역시 연수구)을 관할하는 인천지방법원을 1심 관할로 합니다.</p>
      <h2>전자서명</h2>
      <p>가맹점은 청소비서 화면에서 전자서명합니다. 회사는 사용인감을 (인) 위에 날인합니다. 회사는 이 전자계약서를 결제대행사 심사에 제출합니다.</p>
      <p>
        <Choice
          on={isChecked(v(values, '[[EC_CHECK]]'))}
          label="위 계약 내용에 동의합니다"
          readOnly={readOnly}
          onPick={() => set('[[EC_CHECK]]', isChecked(v(values, '[[EC_CHECK]]')) ? '' : 'Y')}
        />
      </p>
      <table className="pg-table">
        <tbody>
          <tr>
            <td>
              <p><strong>가맹점 (전자서명)</strong></p>
              <p>상호: {v(values, '[[EC_MERCHANT_NAME]]')}</p>
              <p>사업자등록번호: {v(values, '[[EC_BIZ_NO]]')}</p>
              <p>주소: {v(values, '[[EC_SIGNER_ADDRESS]]')}</p>
              <p>서명자 이름: {v(values, '[[EC_SIGNER_NAME]]')}</p>
              <p>도장: {seal ? <img className="pg-seal" src={seal} alt="가맹점 도장" /> : null}</p>
              <p>서명: {sign ? <img className="pg-sign-img" src={sign} alt="서명" /> : null}</p>
            </td>
            <td>
              <p><strong>회사</strong></p>
              <p>상호: 주식회사 서비스브릿지</p>
              <p>대표자: 이정무 <img className="pg-seal" src={SEAL} alt="사용인감" /> (인)</p>
              <p>사업자등록번호: 138-87-04035</p>
              <p>법인등록번호: 120111-0154855</p>
              <p>본점: 인천광역시 연수구 송도미래로 30, 이동 801호, 엠46(송도동, 스마트밸리지식산업센터)</p>
            </td>
          </tr>
        </tbody>
      </table>
      <p>이 약관 게시로 회사의 청약 유인을 갈음합니다. 결제대행사는 서명란의 당사자가 아닙니다. 전자지급결제대행은 주식회사 원성페이먼츠가 수행합니다.</p>
    </ContractSheet>
  );
}

export function ContractPage10({ values, set, readOnly, contractNo }: PageProps) {
  const f = (key: string, width?: string) => field(values, set, readOnly, key, width);
  const on = (key: string) => v(values, key) === 'Y';
  const toggle = (key: string) => set(key, on(key) ? '' : 'Y');
  return (
    <ContractSheet page={10} contractNo={contractNo}>
      <h2>부속서 1. 실제 소유자 확인서</h2>
      <p>이 확인서는 특정금융정보법 제5조의2에 따라 결제대행사(주식회사 원성페이먼츠)가 가맹점을 확인하는 서류입니다. 가맹점이 작성하면 회사가 결제대행사에 전달합니다.</p>
      <p>내용이 바뀌면 바로 다시 작성하여 회사에 알립니다. 거절하거나 확인할 수 없으면 결제대행사가 거래를 거절하거나 끝낼 수 있습니다.</p>
      <table className="pg-table">
        <tbody>
          <tr><th>상호</th><td>한글 {f('[[EC_MERCHANT_NAME]]')} 영문 {f('pgNameEn')}</td></tr>
          <tr><th>사업자등록번호</th><td>{v(values, '[[EC_BIZ_NO]]')}</td></tr>
          <tr><th>연락처</th><td>{v(values, '[[EC_SIGNER_PHONE]]')}</td></tr>
          <tr><th>업종</th><td>{f('pgIndustry')} 업태 {f('pgBizType')}</td></tr>
          <tr><th>사업장 주소</th><td>{v(values, '[[EC_SIGNER_ADDRESS]]')}</td></tr>
        </tbody>
      </table>
      <p>
        개인 거주지
        <Choice on={v(values, 'pgReside') === 'in'} label="국내" readOnly={readOnly} onPick={() => set('pgReside', 'in')} />
        <Choice on={v(values, 'pgReside') === 'out'} label="국외" readOnly={readOnly} onPick={() => set('pgReside', 'out')} />
      </p>
      <p>
        법인
        <Choice on={v(values, 'pgCorpKind') === 'profit'} label="영리" readOnly={readOnly} onPick={() => set('pgCorpKind', 'profit')} />
        <Choice on={v(values, 'pgCorpKind') === 'nonprofit'} label="비영리" readOnly={readOnly} onPick={() => set('pgCorpKind', 'nonprofit')} />
        법인등록번호 {f('pgCorpNo')} 국적 {f('pgNation', '20mm')}
      </p>
      <p>본점 주소 {f('pgHqAddr', '80mm')} <span className="pg-muted">사업장과 다르면 적습니다.</span></p>
      <p>대표자 1 한글 {v(values, '[[EC_SIGNER_NAME]]')} 영문 {f('pgRepEn')} 생년월일 {f('pgBirth')} 국적 {f('pgRepNation', '18mm')}</p>
      <p>대표자 2 {f('pgRep2')} <span className="pg-muted">공동대표가 있을 때만</span></p>
      <h2>실제 소유자</h2>
      <p>실제 소유자는 가맹점을 최종적으로 지배하거나 통제하는 사람입니다.</p>
      <p>
        개인: 대표자와 실제 소유자가 같습니까?
        <Choice on={isChecked(v(values, 'pgOwnerSame'))} label="예" readOnly={readOnly} onPick={() => set('pgOwnerSame', 'Y')} />
        <Choice on={v(values, 'pgOwnerSame') === 'N'} label="아니오" readOnly={readOnly} onPick={() => set('pgOwnerSame', 'N')} />
      </p>
      <p>아니오이면 실제 소유자 한글 {f('pgOwnerName')} 영문 {f('pgOwnerEn')} 생년월일 {f('pgOwnerBirth')} 국적 {f('pgOwnerNation', '16mm')}</p>
      <p>
        법인 확인 생략
        <Choice on={on('pgSkipGov')} label="국가·지자체" readOnly={readOnly} onPick={() => toggle('pgSkipGov')} />
        <Choice on={on('pgSkipPublic')} label="공공기관" readOnly={readOnly} onPick={() => toggle('pgSkipPublic')} />
        <Choice on={on('pgSkipFin')} label="금융회사" readOnly={readOnly} onPick={() => toggle('pgSkipFin')} />
        <Choice on={on('pgSkipListed')} label="사업보고서 제출 대상" readOnly={readOnly} onPick={() => toggle('pgSkipListed')} />
      </p>
      <p><Choice on={v(values, 'pgOwnerStep') === '1'} label="1단계 지분 25% 이상인 사람" readOnly={readOnly} onPick={() => set('pgOwnerStep', '1')} /></p>
      <p><Choice on={v(values, 'pgOwnerStep') === '2'} label="2단계 최대 지분·대표자 선임·사실상 지배" readOnly={readOnly} onPick={() => set('pgOwnerStep', '2')} /></p>
      <p><Choice on={v(values, 'pgOwnerStep') === '3'} label="3단계 대표자" readOnly={readOnly} onPick={() => set('pgOwnerStep', '3')} /></p>
      <p>실제 소유자 1 {f('pgOwner1')} 실제 소유자 2 {f('pgOwner2')}</p>
      <p>
        거래 목적
        <Choice on={v(values, 'pgPurpose') === 'biz'} label="사업상 거래" readOnly={readOnly} onPick={() => set('pgPurpose', 'biz')} />
        <Choice on={v(values, 'pgPurpose') === 'etc'} label="기타" readOnly={readOnly} onPick={() => set('pgPurpose', 'etc')} />
      </p>
      <p>
        자금 원천
        <Choice on={on('pgFundBiz')} label="사업소득" readOnly={readOnly} onPick={() => toggle('pgFundBiz')} />
        <Choice on={on('pgFundWage')} label="근로·연금" readOnly={readOnly} onPick={() => toggle('pgFundWage')} />
        <Choice on={on('pgFundRent')} label="부동산 임대" readOnly={readOnly} onPick={() => toggle('pgFundRent')} />
        <Choice on={on('pgFundSale')} label="부동산 양도" readOnly={readOnly} onPick={() => toggle('pgFundSale')} />
        <Choice on={on('pgFundFin')} label="금융소득" readOnly={readOnly} onPick={() => toggle('pgFundFin')} />
        <Choice on={on('pgFundGift')} label="상속·증여" readOnly={readOnly} onPick={() => toggle('pgFundGift')} />
        <Choice on={on('pgFundEtc')} label="기타" readOnly={readOnly} onPick={() => toggle('pgFundEtc')} />
      </p>
      <p>
        법인 구분
        <Choice on={v(values, 'pgCorpSize') === 'smb'} label="중소기업" readOnly={readOnly} onPick={() => set('pgCorpSize', 'smb')} />
        <Choice on={v(values, 'pgCorpSize') === 'large'} label="대기업" readOnly={readOnly} onPick={() => set('pgCorpSize', 'large')} />
        상장
        <Choice on={v(values, 'pgListed') === 'no'} label="비상장" readOnly={readOnly} onPick={() => set('pgListed', 'no')} />
        <Choice on={v(values, 'pgListed') === 'krx'} label="유가증권" readOnly={readOnly} onPick={() => set('pgListed', 'krx')} />
        <Choice on={v(values, 'pgListed') === 'kosdaq'} label="코스닥" readOnly={readOnly} onPick={() => set('pgListed', 'kosdaq')} />
        <Choice on={v(values, 'pgListed') === 'oversea'} label="해외" readOnly={readOnly} onPick={() => set('pgListed', 'oversea')} />
      </p>
      <p>설립일 {f('pgFounded', '36mm')}</p>
    </ContractSheet>
  );
}

export function ContractPage11({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={11} contractNo={contractNo}>
      <p className="pg-center">년　　월　　일</p>
      <p>상호:　　　　　　　　대표자:　　　　　　　　(서명 또는 날인)</p>
      <p>주식회사 서비스브릿지를 거쳐 주식회사 원성페이먼츠에 제출합니다.</p>
      <h2>부속서 2. 입점할 수 없는 거래</h2>
      <p>아래는 카드사·결제대행사가 일반적으로 거절하거나, 사전 협의 없이 열지 않는 유형입니다. 가맹점이 이 결제로 받을 수 있는 범위는 청소 및 이와 직접 관련된 용역입니다.</p>
      <table className="pg-table">
        <tbody>
          <tr><th>유형</th><th>예</th></tr>
          <tr><td>주류·담배</td><td>담배, 전자담배, 주류</td></tr>
          <tr><td>의약품</td><td>전문의약품, 의료기기 판매(의료기관이 고객인 경우 포함될 수 있음)</td></tr>
          <tr><td>성인·사행</td><td>성인용품, 성인 유료 서비스, 도박, 경마·경륜, 복권</td></tr>
          <tr><td>현금화</td><td>상품권, 기프티콘, 포인트·캐시 충전, 골드바·순금, 대출·대부, 카드 현금화</td></tr>
          <tr><td>회원·다단계</td><td>다단계, 방문판매, 회원권, 가입비 성격의 장기 용역</td></tr>
          <tr><td>중고·고가</td><td>중고차, 자동차, 명품 중고, 골동품, 미술품</td></tr>
          <tr><td>기타 제한</td><td>총포·도검, 살아있는 동물 분양, 해외 서버를 통한 우회 결제, 결제대행사가 지정한 입점 불가 업종</td></tr>
        </tbody>
      </table>
      <p>입주·거주 청소처럼 짧은 기간의 용역 제공은 위 제한의 “장기 용역”에 해당하지 않습니다. 4개월 이상 선불로 한 번에 받는 구조이면 결제대행사와 먼저 협의합니다.</p>
      <h2>부속서 3. 거래 확인</h2>
      <p>가맹점은 이용자가 가맹점 앞으로 결제한 금액에 관하여, 유사수신·보이스피싱·대출 사기 등 거짓 매출이 없도록 확인하고, 민원이 생기면 결제대행사와 회사가 요청한 자료를 내며 취소·환불을 처리합니다. 이를 이행하지 않아 생긴 손해는 가맹점이 부담합니다.</p>
      <p className="pg-center">년　　월　　일</p>
      <p>상호:　　　　　　　　대표자:　　　　　　　　(서명 또는 날인)</p>
    </ContractSheet>
  );
}
