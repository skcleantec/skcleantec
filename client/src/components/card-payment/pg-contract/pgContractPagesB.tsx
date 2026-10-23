import { Blank, Choice, ContractImage, isChecked, type ContractValues, type FlowBlock, type PageProps } from './pgContractChrome';

const SEAL = '/brand/service-bridge-seal.png';

function v(values: ContractValues, key: string) {
  return values[key] ?? '';
}

function field(values: ContractValues, set: PageProps['set'], readOnly: boolean, key: string, width = '28mm') {
  return (
    <Blank width={width} fieldKey={key} value={v(values, key)} readOnly={readOnly} onChange={(next) => set(key, next)} />
  );
}

function block(key: string, label: string, node: FlowBlock['node'], gate?: FlowBlock['gate']): FlowBlock {
  return { key, label, node, gate };
}

export function contractBlocksB({ values, set, readOnly }: PageProps): FlowBlock[] {
  const f = (key: string, width?: string) => field(values, set, readOnly, key, width);
  const on = (key: string) => v(values, key) === 'Y';
  const toggle = (key: string) => set(key, on(key) ? '' : 'Y');
  const seal = v(values, '[[EC_SEAL]]');
  const sign = v(values, '[[EC_SIGNATURE]]');
  const kind = v(values, 'pgBizKind');
  return [
    block('art8', '제8조', <><h2>제8조 (가맹점의 의무)</h2><p>① 이용자가 결제 화면에서 대금 청구 명의와 가맹점을 알아볼 수 있게 합니다. ② 본인 사용과 실제 용역 제공인지는 가맹점이 확인합니다. ③ 카드 결제라는 이유로 이용자를 거절하거나 불리하게 하지 않고, 수수료를 이용자에게 떠넘기지 않습니다. ④ 용역 제공 없이 결제한 것처럼 꾸미거나, 실제보다 큰 금액으로 결제하거나, 다른 가맹점 이름으로 결제하거나, 이름을 빌려 주거나, 카드결제를 대신 받아 주지 않습니다. ⑤ 거래정보는 5년 이상 보관하고, 요구를 받으면 영업일 3일 안에 냅니다. ⑥ 이용자 정보를 회사에 넘길 때는 동의를 받습니다. ⑦ 전자상거래법 등 가맹점 의무는 가맹점이 이행하고, 그 의무를 회사나 결제대행사에 넘기지 않습니다.</p></>),
    block('art9', '제9조', <><h2>제9조 (금지 거래)</h2><p>① 신청서에 적은 청소 및 직접 관련 용역만 이 결제로 받습니다. ② 주류, 담배, 의약품, 성인용품, 사행성, 대출·현금화, 상품권 등 부속서와 카드사·결제대행사가 금지한 품목은 판매하지 않습니다. ③ 위반 거래는 결제대행사가 취소할 수 있고, 회사는 연동을 멈출 수 있습니다. 그 손해는 가맹점이 부담합니다.</p></>),
    block('art10', '제10조', <><h2>제10조 (비정상거래, 취소, 민원)</h2><p>① 거래 확인을 요구하면 영업일 3일 안에 거래정보를 냅니다. ② 법령·카드사 규정·비정상거래를 이유로 취소를 요구하면 취소하고 대금을 돌립니다. 취소 가능 기간은 카드사 기준(통상 승인일부터 1년 안)입니다. ③ 영업일 7일 안에 정당한 취소를 처리하지 않으면 결제대행사가 직접 취소할 수 있고, 이미 정산된 금액은 다음 정산금에서 빼거나 가맹점에 청구합니다. ④ 비정상거래, 미제공, 현금화, 허위 매출, 이용자 이의, 보전처분, 담보 미제공, 금지 용역이면 정산금의 전부 또는 일부를 보류할 수 있습니다. 회사는 새 승인을 멈출 수 있고, 보류를 푸는 권한은 결제대행사에 있습니다. ⑤ 민원은 가맹점이 해결하고, 그 손해는 가맹점이 배상합니다. ⑥ 분실·도난·위조·변조를 몰랐고 고의·중과실이 없으면 회수 책임은 경감될 수 있습니다. 그 점은 가맹점이 소명합니다.</p></>),
    block('art1113', '제11조~제13조', <><h2>제11조 (담보) · 제12조 (한도) · 제13조 (통지)</h2><p>보증보험, 예치, 정산금 유보는 가맹점이 결제대행사에 제공합니다. 회사는 담보의 수익자가 아니고 보험료를 임의로 내지 않습니다. 승인한도와 할부 개월 수는 결제대행사가 정하고, 그 제한으로 생긴 영업 손실은 가맹점이 부담합니다. 상호, 대표자, 주소, 연락처, 판매 용역, 정산 계좌가 바뀌면 지체 없이 알립니다. 알리지 않으면 마지막 연락처에 도달한 때 통지가 도달한 것으로 봅니다. 회사는 수수료, 정산일, 서비스 중단처럼 중요한 변경을 이메일 또는 화면으로 알립니다.</p></>),
    block('art1415', '제14조 · 제15조', <><h2>제14조 (회사의 의무) · 제15조 (개인정보와 비밀)</h2><p>회사는 접수, 결제 화면 연결, 장애·정책 변경의 전달을 성실히 합니다. 회사 시스템 하자로 생긴 통상 손해는 회사가 배상하고, 결제대행사·카드사·통신망 장애는 고의·중과실이 아니면 제외합니다. 이용자 정보, 거래정보, 영업비밀은 법령과 이 계약에서 정한 제공 외에는 넘기지 않습니다. 수사·감독·카드사·세무 자료 요구는 예외입니다. 실제 소유자 확인 자료는 가맹점이 내고 회사가 결제대행사에 전달합니다. 거부하면 거래를 거절·종료할 수 있습니다.</p></>),
    block('art16', '제16조', <><h2>제16조 (기간, 중지, 해지)</h2><p>① 기간은 카드결제를 쓸 수 있게 된 날부터 1년이고, 끝나기 1개월 전까지 끝낸다는 뜻이 없으면 1년씩 이어집니다. 청소비서 회원 자격이 끝나면 이 계약도 끝납니다. ② 위반하면 14일 이상 시정 기간을 주고, 시정되지 않으면 해지할 수 있습니다. ③ 결제대행사의 가맹 해지·심사 취소, 거짓 신청, 금지 용역, 연락 두절, 영업 중단, 반복 민원, 파산·회생·부도이면 시정 기간 없이 연동을 멈추거나 끝낼 수 있습니다. ④ 잠시 멈추려면 미리 알리고 그 기간의 취소·민원 처리 방법을 정합니다. ⑤ 계약이 끝나도 이미 생긴 취소, 민원, 정산, 손해배상, 비밀, 개인정보 의무는 남습니다.</p></>),
    block('art1720', '제17조~제20조', <><h2>제17조부터 제20조</h2><p>합병, 영업양도, 법인 전환은 30일 전에 알리고 동의를 받습니다. 대표자 또는 사업자등록번호가 바뀌면 신규 심사일 수 있습니다. 계약을 어겨 생긴 통상 손해와 분쟁 해결의 합리적인 비용은 귀책 있는 쪽이 부담합니다. 정하지 않은 사항은 전자금융거래법, 여신전문금융업법, 전자상거래법, 개인정보 보호법, 특정금융정보법과 카드사 규정을 따릅니다. 체크카드와 직불카드는 신용카드 규정을 같이 적용합니다. 분쟁이 협의되지 않으면 회사 본점(인천광역시 연수구)을 관할하는 인천지방법원을 1심 관할로 합니다.</p></>),
    block(
      'sign',
      '전자서명',
      <>
        <h2>전자서명</h2>
        <p>가맹점은 청소비서 화면에서 전자서명합니다. 회사는 사용인감을 (인) 위에 날인하고, 이 전자계약서를 결제대행사 심사에 제출합니다. 결제대행사는 서명란의 당사자가 아니며, 전자지급결제대행은 주식회사 원성페이먼츠가 수행합니다.</p>
        <p>
          <Choice
            fieldKey="[[EC_CHECK]]"
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
                <p><strong>가맹점</strong> 상호 {v(values, '[[EC_MERCHANT_NAME]]')} · 사업자 {v(values, '[[EC_BIZ_NO]]')}</p>
                <p>주소 {v(values, '[[EC_SIGNER_ADDRESS]]')} · 서명자 {v(values, '[[EC_SIGNER_NAME]]')}</p>
                <p>
                  도장 <ContractImage className="pg-seal" src={seal} alt="가맹점 도장" /> 서명{' '}
                  <ContractImage className="pg-sign-img" src={sign} alt="서명" />
                </p>
              </td>
              <td>
                <p><strong>회사</strong> 주식회사 서비스브릿지</p>
                <p>대표자 이정무 <ContractImage className="pg-seal" src={SEAL} alt="사용인감" /> (인)</p>
                <p>138-87-04035 · 120111-0154855</p>
              </td>
            </tr>
          </tbody>
        </table>
      </>,
      'sign',
    ),
    block(
      'aml-head',
      '실제 소유자',
      <>
        <h2>부속서 1. 실제 소유자 확인서</h2>
        <p>특정금융정보법 제5조의2에 따라 결제대행사(주식회사 원성페이먼츠)가 가맹점을 확인하는 서류입니다. 가맹점이 작성하면 회사가 전달합니다. 내용이 바뀌면 다시 작성하고, 거절하거나 확인할 수 없으면 거래를 거절·종료할 수 있습니다.</p>
        <p>상호 {v(values, '[[EC_MERCHANT_NAME]]')} 영문 {f('pgNameEn')} 사업자 {v(values, '[[EC_BIZ_NO]]')} 연락처 {v(values, '[[EC_SIGNER_PHONE]]')}</p>
        <p>업종 {f('pgIndustry')} 업태 {f('pgBizType')} 주소 {v(values, '[[EC_SIGNER_ADDRESS]]')}</p>
      </>,
    ),
    block(
      'aml-kind',
      '실제 소유자',
      <>
        <p>
          거주지
          <Choice on={v(values, 'pgReside') === 'in'} label="국내" readOnly={readOnly} onPick={() => set('pgReside', 'in')} />
          <Choice on={v(values, 'pgReside') === 'out'} label="국외" readOnly={readOnly} onPick={() => set('pgReside', 'out')} />
          국적 {f('pgNation', '16mm')}
        </p>
        {kind === 'corp' ? (
          <p>
            법인
            <Choice on={v(values, 'pgCorpKind') === 'profit'} label="영리" readOnly={readOnly} onPick={() => set('pgCorpKind', 'profit')} />
            <Choice on={v(values, 'pgCorpKind') === 'nonprofit'} label="비영리" readOnly={readOnly} onPick={() => set('pgCorpKind', 'nonprofit')} />
            법인번호 {f('pgCorpNo')}
          </p>
        ) : null}
        <p>
          {kind === 'corp' ? <>본점 {f('pgHqAddr', '50mm')} </> : null}
          대표자 {v(values, '[[EC_SIGNER_NAME]]')} 영문 {f('pgRepEn')} 생년월일 {f('pgBirth')} 공동대표 {f('pgRep2')}
          <span className="pg-muted"> 공동대표가 없으면 비웁니다.</span>
        </p>
        <p>실제 소유자는 가맹점을 최종적으로 지배하는 사람입니다. 대표자와 같습니까?</p>
        <p>
          <Choice on={isChecked(v(values, 'pgOwnerSame'))} label="예" readOnly={readOnly} onPick={() => set('pgOwnerSame', 'Y')} />
          <Choice on={v(values, 'pgOwnerSame') === 'N'} label="아니오" readOnly={readOnly} onPick={() => set('pgOwnerSame', 'N')} />
          아니오이면 {f('pgOwnerName')} {f('pgOwnerBirth')} {f('pgOwnerNation', '16mm')}
        </p>
      </>,
    ),
    block(
      'aml-step',
      '실제 소유자',
      <>
        <p>
          <Choice on={v(values, 'pgOwnerStep') === '1'} label="1단계 지분 25% 이상" readOnly={readOnly} onPick={() => set('pgOwnerStep', '1')} />
          <Choice on={v(values, 'pgOwnerStep') === '2'} label="2단계 최대 지분·사실상 지배" readOnly={readOnly} onPick={() => set('pgOwnerStep', '2')} />
          <Choice on={v(values, 'pgOwnerStep') === '3'} label="3단계 대표자" readOnly={readOnly} onPick={() => set('pgOwnerStep', '3')} />
        </p>
        {kind === 'corp' ? (
          <p>
            확인 생략
            <Choice on={on('pgSkipGov')} label="국가·지자체" readOnly={readOnly} onPick={() => toggle('pgSkipGov')} />
            <Choice on={on('pgSkipPublic')} label="공공기관" readOnly={readOnly} onPick={() => toggle('pgSkipPublic')} />
            <Choice on={on('pgSkipFin')} label="금융회사" readOnly={readOnly} onPick={() => toggle('pgSkipFin')} />
            <Choice on={on('pgSkipListed')} label="사업보고서 제출" readOnly={readOnly} onPick={() => toggle('pgSkipListed')} />
          </p>
        ) : null}
        <p>실제 소유자 1 {f('pgOwner1', '36mm')} 실제 소유자 2 {f('pgOwner2', '36mm')}</p>
        <p className="pg-muted">실제 소유자가 한 명이면 2번은 비워도 됩니다. 영문 상호·영문 대표자·국적도 없으면 비워도 됩니다.</p>
      </>,
    ),
    block(
      'aml-fund',
      '실제 소유자',
      <>
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
        {kind === 'corp' ? (
          <p>
            법인
            <Choice on={v(values, 'pgCorpSize') === 'smb'} label="중소기업" readOnly={readOnly} onPick={() => set('pgCorpSize', 'smb')} />
            <Choice on={v(values, 'pgCorpSize') === 'large'} label="대기업" readOnly={readOnly} onPick={() => set('pgCorpSize', 'large')} />
            <Choice on={v(values, 'pgListed') === 'no'} label="비상장" readOnly={readOnly} onPick={() => set('pgListed', 'no')} />
            <Choice on={v(values, 'pgListed') === 'krx'} label="유가증권" readOnly={readOnly} onPick={() => set('pgListed', 'krx')} />
            <Choice on={v(values, 'pgListed') === 'kosdaq'} label="코스닥" readOnly={readOnly} onPick={() => set('pgListed', 'kosdaq')} />
            <Choice on={v(values, 'pgListed') === 'oversea'} label="해외" readOnly={readOnly} onPick={() => set('pgListed', 'oversea')} />
            설립일 {f('pgFounded', '28mm')}
          </p>
        ) : null}
        <p>위 확인서를 주식회사 서비스브릿지를 거쳐 주식회사 원성페이먼츠에 제출합니다.</p>
      </>,
    ),
    block(
      'banned',
      '입점 제한',
      <>
        <h2>부속서 2. 입점할 수 없는 거래</h2>
        <p>카드사·결제대행사가 일반적으로 거절하거나 사전 협의 없이 열지 않는 유형입니다. 이 결제로 받을 수 있는 범위는 청소 및 직접 관련 용역입니다.</p>
        <table className="pg-table">
          <tbody>
            <tr><th>유형</th><th>예</th></tr>
            <tr><td>주류·담배</td><td>담배, 전자담배, 주류</td></tr>
            <tr><td>의약품</td><td>전문의약품, 의료기기 판매</td></tr>
            <tr><td>성인·사행</td><td>성인용품, 성인 유료 서비스, 도박, 경마·경륜, 복권</td></tr>
            <tr><td>현금화</td><td>상품권, 기프티콘, 포인트·캐시 충전, 순금, 대출·대부, 카드 현금화</td></tr>
            <tr><td>회원·다단계</td><td>다단계, 방문판매, 회원권, 가입비 성격의 장기 용역</td></tr>
            <tr><td>중고·고가</td><td>중고차, 자동차, 명품 중고, 골동품, 미술품</td></tr>
            <tr><td>기타 제한</td><td>총포·도검, 동물 분양, 해외 서버 우회 결제, 입점 불가 업종</td></tr>
          </tbody>
        </table>
        <p>입주·거주 청소처럼 짧은 용역은 장기 용역에 해당하지 않습니다. 4개월 이상 선불이면 결제대행사와 먼저 협의합니다.</p>
      </>,
    ),
    block(
      'confirm',
      '거래 확인',
      <>
        <h2>부속서 3. 거래 확인</h2>
        <p>가맹점은 이용자가 가맹점 앞으로 결제한 금액에 관하여 유사수신·보이스피싱·대출 사기 등 거짓 매출이 없도록 확인하고, 민원이 생기면 요청한 자료를 내며 취소·환불을 처리합니다. 이를 이행하지 않아 생긴 손해는 가맹점이 부담합니다.</p>
      </>,
    ),
    block(
      'doc-guide',
      '필요 서류',
      <div className="pg-doc-guide">
        <h2>필요 서류와 진행 순서</h2>
        <p>가맹신청 → 가맹 심사완료 → 가맹점 계약서 작성 → 계약서 우편발송 → 가맹점 코드 연결 및 사용</p>
        {kind === 'solo' ? (
          <>
            <p>개인사업자는 가맹 신청할 때 아래 3가지를 사진으로 올립니다.</p>
            <ol>
              <li>사업자등록증</li>
              <li>통장사본</li>
              <li>신분증</li>
            </ol>
          </>
        ) : kind === 'corp' ? (
          <>
            <p>법인사업자는 아래 4가지를 우편으로 주식회사 원성페이먼츠 본사에 보냅니다. 이 화면에는 올리지 않습니다.</p>
            <ol>
              <li>사업자등록증</li>
              <li>통장사본</li>
              <li>법인인감</li>
              <li>법인등기부</li>
            </ol>
          </>
        ) : (
          <p>위에서 개인사업자 또는 법인을 고르면 필요한 서류만 여기에 나옵니다.</p>
        )}
      </div>,
    ),
  ];
}
