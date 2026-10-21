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

export function ContractPage7({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={7} contractNo={contractNo}>
      <h2>8. 전자서명으로 신청</h2>
      <p>대표자 또는 계약 권한이 있는 관리자가 청소비서에서 이 약관에 동의하고 전자서명하면 이용계약 체결을 신청한 것으로 봅니다. 인감 날인은 하지 않습니다.</p>
      <p>이 신청은 주식회사 서비스브릿지(대표자 이정무)에게 합니다.</p>
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
    </ContractSheet>
  );
}

export function ContractPage8({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={8} contractNo={contractNo}>
      <h2>제3조 (용어)</h2>
      <p>“이용자”는 가맹점의 청소 용역을 카드로 결제하는 고객입니다. “비정상거래”는 분실·도난·도용 카드, 현금화, 용역 제공 없는 결제, 가맹점이 제공을 증명하지 못한 거래입니다.</p>
      <h2>제4조 (계약이 성립하는 때)</h2>
      <p>① 전자서명으로 청약하고, 회사가 서류를 확인하며 결제대행사가 가맹 심사를 승인하면 카드결제를 쓸 수 있습니다. 심사 전 선결제는 없습니다.</p>
      <p>② 타인 명의나 거짓 서류로 성립한 계약은 무효입니다. 기재 누락·보증 미비는 보류하고, 입점 불가 업종·실명이 아닌 신청은 거절할 수 있습니다.</p>
      <h2>제5조 (서비스 범위)</h2>
      <p>회사는 결제 화면 연동, 신청 상태 안내, 기술 문의를 제공합니다. 결제창 가동 시간은 결제대행사를 따릅니다. 가맹점은 결제 모듈을 수정하거나 카드번호를 승인 뒤에 저장하지 않습니다.</p>
      <h2>제6조 (수수료)</h2>
      <p>가맹점은 앞쪽 신청서의 수수료 3.3%(부가세 별도)를 부담합니다. 정산 때 결제대금에서 공제하는 것을 원칙으로 합니다. 영세·중소 우대와 카드사 원가가 바뀌면 회사는 화면 또는 이메일로 알립니다.</p>
    </ContractSheet>
  );
}

export function ContractPage9({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={9} contractNo={contractNo}>
      <h2>제7조 (정산)</h2>
      <p>① 결제대행사는 일정산으로, 승인금액에서 취소를 빼고 수수료를 공제한 뒤 가맹점 계좌로 지급합니다.</p>
      <p>② 세금계산서는 회사 이용료와 결제대행사 부분을 나누어 발행합니다. 취소금이 모자라면 가맹점이 돌려줍니다.</p>
      <p>③ 계좌 변경은 영업일 7일 전에 알립니다. 카드사 사정으로 입금이 늦어도 회사의 고의·중과실이 아니면 회사가 대신 지급하지 않습니다.</p>
      <h2>제8조 (가맹점의 의무)</h2>
      <p>이용자가 청구 명의를 알아볼 수 있게 하고, 본인 사용과 실제 용역 제공을 확인합니다. 카드 결제라는 이유로 이용자를 불리하게 하거나 수수료를 떠넘기지 않습니다. 거래정보는 5년 이상 보관합니다.</p>
      <h2>제9조 (금지 거래)</h2>
      <p>청소 및 직접 관련 용역만 받습니다. 주류, 담배, 의약품, 성인용품, 사행성, 대출·현금화, 상품권 등 부속서의 금지 품목은 판매하지 않습니다.</p>
    </ContractSheet>
  );
}

export function ContractPage10({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={10} contractNo={contractNo}>
      <h2>제10조 (비정상거래, 취소, 민원)</h2>
      <p>거래 확인 요청에는 영업일 3일 안에 자료를 냅니다. 정당한 취소는 영업일 7일 안에 처리하고, 그렇지 않으면 결제대행사가 직접 취소할 수 있습니다. 민원은 가맹점이 해결합니다.</p>
      <h2>제11조 (담보) · 제12조 (한도)</h2>
      <p>보증보험·예치·정산 유보는 가맹점이 결제대행사에 제공합니다. 회사는 담보 수익자가 아닙니다. 승인한도는 결제대행사가 정합니다.</p>
      <h2>제13조 (통지) · 제14조 (회사의 의무)</h2>
      <p>상호, 대표자, 주소, 계좌가 바뀌면 지체 없이 알립니다. 회사는 접수, 화면 연결, 장애·정책 변경의 전달을 성실히 하고, 회사 시스템 하자로 생긴 통상 손해를 배상합니다.</p>
      <h2>제15조 (개인정보와 비밀)</h2>
      <p>이용자 정보와 영업비밀은 이 계약과 법령에서 정한 제공 외에는 넘기지 않습니다. 실제 소유자 확인 자료는 회사가 결제대행사에 전달합니다.</p>
    </ContractSheet>
  );
}

export function ContractPage11({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={11} contractNo={contractNo}>
      <h2>제16조 (기간, 중지, 해지)</h2>
      <p>기간은 카드결제를 쓸 수 있게 된 날부터 1년이고, 끝나기 1개월 전까지 끝낸다는 뜻이 없으면 1년씩 이어집니다. 위반은 14일 이상 시정 기간을 줍니다. 거짓 신청, 금지 용역, 결제대행사의 가맹 해지는 즉시 멈출 수 있습니다. 이미 생긴 취소·정산·비밀 의무는 남습니다.</p>
      <h2>제17조 (지위 이전) · 제18조 (손해배상)</h2>
      <p>합병·영업양도·법인 전환은 30일 전에 알리고 동의를 받습니다. 계약을 어겨 생긴 통상 손해는 귀책 있는 쪽이 배상합니다.</p>
      <h2>제19조 (정하지 않은 사항)</h2>
      <p>전자금융거래법, 여신전문금융업법, 전자상거래법, 개인정보 보호법, 특정금융정보법과 카드사 규정을 따릅니다.</p>
      <h2>제20조 (분쟁)</h2>
      <p>협의가 되지 않으면 회사 본점(인천광역시 연수구)을 관할하는 인천지방법원을 1심 관할로 합니다.</p>
    </ContractSheet>
  );
}

export function ContractPage12({ values, set, readOnly, contractNo }: PageProps) {
  const seal = v(values, '[[EC_SEAL]]');
  const sign = v(values, '[[EC_SIGNATURE]]');
  return (
    <ContractSheet page={12} contractNo={contractNo}>
      <h2>전자서명</h2>
      <p>가맹점은 이 화면에서 동의하고 서명합니다. 회사 사용인감은 (인) 위에 고정되어 있습니다. 이 전자계약서는 결제대행사 심사에 제출합니다.</p>
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
              <p><strong>가맹점</strong></p>
              <p>상호: {v(values, '[[EC_MERCHANT_NAME]]')}</p>
              <p>사업자등록번호: {v(values, '[[EC_BIZ_NO]]')}</p>
              <p>주소: {v(values, '[[EC_SIGNER_ADDRESS]]')}</p>
              <p>대표자: {v(values, '[[EC_SIGNER_NAME]]')}</p>
              <p>도장: {seal ? <img className="pg-seal" src={seal} alt="가맹점 도장" /> : <Blank width="20mm" value="" readOnly onChange={() => undefined} />}</p>
              <p>서명: {sign ? <img className="pg-sign-img" src={sign} alt="서명" /> : null}</p>
            </td>
            <td>
              <p><strong>회사</strong></p>
              <p>상호: 주식회사 서비스브릿지</p>
              <p>대표자: 이정무 <img className="pg-seal" src={SEAL} alt="사용인감" /> (인)</p>
              <p>사업자등록번호: 138-87-04035</p>
              <p>본점: 인천광역시 연수구 송도미래로 30, 이동 801호</p>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="pg-muted">결제대행사는 서명란의 당사자가 아닙니다.</p>
    </ContractSheet>
  );
}

export function ContractPage13({ values, set, readOnly, contractNo }: PageProps) {
  return (
    <ContractSheet page={13} contractNo={contractNo}>
      <h2>부속서 1. 실제 소유자 확인서</h2>
      <p>특정금융정보법 제5조의2에 따라 결제대행사가 가맹점을 확인하는 서류입니다. 회사가 원성페이먼츠에 전달합니다.</p>
      <table className="pg-table">
        <tbody>
          <tr><th>상호</th><td>{v(values, '[[EC_MERCHANT_NAME]]')}</td><th>연락처</th><td>{v(values, '[[EC_SIGNER_PHONE]]')}</td></tr>
          <tr><th>사업자번호</th><td colSpan={3}>{v(values, '[[EC_BIZ_NO]]')}</td></tr>
          <tr><th>주소</th><td colSpan={3}>{v(values, '[[EC_SIGNER_ADDRESS]]')}</td></tr>
        </tbody>
      </table>
      <p>
        거주지
        <Choice on={v(values, 'pgReside') === 'in'} label="국내" readOnly={readOnly} onPick={() => set('pgReside', 'in')} />
        <Choice on={v(values, 'pgReside') === 'out'} label="국외" readOnly={readOnly} onPick={() => set('pgReside', 'out')} />
      </p>
      <p>
        법인
        <Choice on={v(values, 'pgCorpKind') === 'profit'} label="영리" readOnly={readOnly} onPick={() => set('pgCorpKind', 'profit')} />
        <Choice on={v(values, 'pgCorpKind') === 'nonprofit'} label="비영리" readOnly={readOnly} onPick={() => set('pgCorpKind', 'nonprofit')} />
      </p>
      <p>대표자: {v(values, '[[EC_SIGNER_NAME]]')}</p>
    </ContractSheet>
  );
}

export function ContractPage14({ values, set, readOnly, contractNo }: PageProps) {
  return (
    <ContractSheet page={14} contractNo={contractNo}>
      <h2>실제 소유자</h2>
      <p>실제 소유자는 가맹점을 최종적으로 지배하거나 통제하는 사람입니다. 해당하는 칸을 체크한 뒤 다음으로 갑니다.</p>
      <p>
        대표자와 실제 소유자가 같습니까?
        <Choice on={isChecked(v(values, 'pgOwnerSame'))} label="예" readOnly={readOnly} onPick={() => set('pgOwnerSame', 'Y')} />
        <Choice on={v(values, 'pgOwnerSame') === 'N'} label="아니오" readOnly={readOnly} onPick={() => set('pgOwnerSame', 'N')} />
      </p>
      <p>
        <Choice on={v(values, 'pgOwnerStep') === '1'} label="1단계 지분 25% 이상" readOnly={readOnly} onPick={() => set('pgOwnerStep', '1')} />
      </p>
      <p>
        <Choice on={v(values, 'pgOwnerStep') === '2'} label="2단계 최대 지분 또는 사실상 지배" readOnly={readOnly} onPick={() => set('pgOwnerStep', '2')} />
      </p>
      <p>
        <Choice on={v(values, 'pgOwnerStep') === '3'} label="3단계 대표자" readOnly={readOnly} onPick={() => set('pgOwnerStep', '3')} />
      </p>
      <p>
        거래 목적
        <Choice on={v(values, 'pgPurpose') === 'biz'} label="사업상 거래" readOnly={readOnly} onPick={() => set('pgPurpose', 'biz')} />
        <Choice on={v(values, 'pgPurpose') === 'etc'} label="기타" readOnly={readOnly} onPick={() => set('pgPurpose', 'etc')} />
      </p>
      <p>
        자금 원천
        <Choice on={v(values, 'pgFund') === 'biz'} label="사업소득" readOnly={readOnly} onPick={() => set('pgFund', 'biz')} />
        <Choice on={v(values, 'pgFund') === 'wage'} label="근로·연금" readOnly={readOnly} onPick={() => set('pgFund', 'wage')} />
        <Choice on={v(values, 'pgFund') === 'etc'} label="기타" readOnly={readOnly} onPick={() => set('pgFund', 'etc')} />
      </p>
      <p>주식회사 서비스브릿지를 거쳐 주식회사 원성페이먼츠에 제출합니다.</p>
    </ContractSheet>
  );
}

export function ContractPage15({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={15} contractNo={contractNo}>
      <h2>부속서 2. 입점할 수 없는 거래</h2>
      <p>가맹점이 이 결제로 받을 수 있는 범위는 청소 및 이와 직접 관련된 용역입니다.</p>
      <table className="pg-table">
        <tbody>
          <tr><th>유형</th><th>예</th></tr>
          <tr><td>주류·담배</td><td>담배, 전자담배, 주류</td></tr>
          <tr><td>의약품</td><td>전문의약품, 의료기기 판매</td></tr>
          <tr><td>성인·사행</td><td>성인용품, 도박, 경마·경륜, 복권</td></tr>
          <tr><td>현금화</td><td>상품권, 기프티콘, 포인트 충전, 대출, 카드 현금화</td></tr>
          <tr><td>회원·다단계</td><td>다단계, 방문판매, 회원권, 가입비 성격의 장기 용역</td></tr>
          <tr><td>중고·고가</td><td>중고차, 자동차, 명품 중고, 골동품, 미술품</td></tr>
          <tr><td>기타 제한</td><td>총포·도검, 동물 분양, 해외 서버 우회 결제</td></tr>
        </tbody>
      </table>
      <p>입주·거주 청소처럼 짧은 용역은 장기 용역에 해당하지 않습니다. 4개월 이상 선불이면 결제대행사와 먼저 협의합니다.</p>
    </ContractSheet>
  );
}

export function ContractPage16({ contractNo }: Pick<PageProps, 'contractNo'>) {
  return (
    <ContractSheet page={16} contractNo={contractNo}>
      <h2>부속서 3. 거래 확인</h2>
      <p>가맹점은 이용자가 가맹점 앞으로 결제한 금액에 관하여 유사수신·보이스피싱·대출 사기 등 거짓 매출이 없도록 확인합니다.</p>
      <p>민원이 생기면 결제대행사와 회사가 요청한 자료를 내고 취소·환불을 처리합니다. 이를 이행하지 않아 생긴 손해는 가맹점이 부담합니다.</p>
      <p>이 페이지까지가 계약서 전체입니다. 인쇄하면 1쪽부터 16쪽까지 이 서식 그대로 나갑니다.</p>
    </ContractSheet>
  );
}
