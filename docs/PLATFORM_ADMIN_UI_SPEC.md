# 플랫폼 관리자 UI 개선 명세서

> **작업 대상 파일**
> - `client/src/pages/platform/PlatformTenantListPage.tsx`
> - `client/src/pages/platform/PlatformTenantDetailPage.tsx`
> - `client/src/pages/platform/PlatformTenantAdminsSection.tsx`
> - `client/src/components/layout/PlatformLayout.tsx`
>
> **코딩 규칙:** 기존 API·타입·store는 변경 없음. UI(JSX + Tailwind)만 수정.  
> **스타일:** TailwindCSS만 사용. 외부 라이브러리 추가 없음.

---

## 1. 공통 디자인 토큰

코드 전체에서 아래 색상·스타일을 일관되게 사용한다.

### 1-1. 상태(Status) 표현

| 상태 | 배지 배경 | 텍스트 | 점(dot) | 사용처 |
|------|-----------|--------|---------|--------|
| ACTIVE (운영) | `bg-emerald-50` | `text-emerald-700` | `bg-emerald-500` | 목록 행·상세 헤더 |
| TRIAL (체험) | `bg-amber-50` | `text-amber-700` | `bg-amber-400` | 목록 행·상세 헤더 |
| SUSPENDED (중지) | `bg-red-50` | `text-red-600` | `bg-red-400` | 목록 행·상세 헤더 |

**배지 공통 클래스:**
```
inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium
```

**점(dot) 공통 클래스:**
```
w-1.5 h-1.5 rounded-full shrink-0
```

### 1-2. 플랜(Plan) 배지

| 플랜 | 배경 | 텍스트 | 테두리 |
|------|------|--------|--------|
| premium | `bg-purple-50` | `text-purple-700` | `ring-1 ring-purple-200` |
| standard | `bg-blue-50` | `text-blue-700` | `ring-1 ring-blue-200` |
| starter | `bg-gray-100` | `text-gray-600` | `ring-1 ring-gray-200` |

**플랜 배지 공통 클래스:**
```
inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize
```

### 1-3. 섹션 카드

```
bg-white border border-gray-200 rounded-xl p-5 space-y-4
```

### 1-4. 버튼

| 종류 | 클래스 |
|------|--------|
| 기본(Primary) | `px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40` |
| 보조(Secondary) | `px-4 py-2 bg-white text-gray-700 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40` |
| 위험(Danger) | `px-4 py-2 bg-white text-red-600 text-sm font-medium border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40` |
| 위험 강조 | `px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40` |
| 텍스트 링크 | `text-sm text-blue-600 hover:underline` |

---

## 2. PlatformLayout 개선

**파일:** `client/src/components/layout/PlatformLayout.tsx`

### 변경 사항

사이드바에 현재 "업체 목록" 링크만 있다면 아래 nav 구조로 확장한다.

```tsx
// 사이드바 상단 로고
<div className="px-4 py-5">
  <span className="text-lg font-bold text-white tracking-tight">
    청소<span className="text-blue-400">비서</span>
  </span>
  <span className="ml-2 text-xs text-gray-500 font-normal">Platform</span>
</div>

// nav 항목 (현재 구현된 라우트만 표시. 미구현은 주석 처리)
const navItems = [
  { label: '업체 관리', to: '/platform/tenants', icon: '🏢' },
  // { label: '플랜 설정', to: '/platform/plans', icon: '📋' },   // 추후 구현
  // { label: '공지 발송', to: '/platform/notices', icon: '📢' }, // 추후 구현
];
```

**nav 항목 active 스타일:**
```
bg-white/10 text-white font-medium
```
**nav 항목 기본 스타일:**
```
text-gray-400 hover:bg-white/5 hover:text-white
```

---

## 3. PlatformTenantListPage 전체 재작성

**파일:** `client/src/pages/platform/PlatformTenantListPage.tsx`

### 3-1. 페이지 구조 (위에서 아래 순서)

```
① 페이지 헤더 (제목 + 업체 개설 버튼)
② KPI 요약 카드 4개 (가로 배열)
③ 검색 + 필터 바
④ 테넌트 테이블 (데스크탑) / 카드 목록 (모바일)
```

### 3-2. ① 페이지 헤더

```tsx
<div className="flex flex-wrap items-center justify-between gap-3">
  <div>
    <h1 className="text-xl font-bold text-gray-900">업체 관리</h1>
    <p className="text-sm text-gray-500 mt-0.5">청소비서를 사용하는 업체를 관리합니다.</p>
  </div>
  <Link to="/platform/tenants/new" className="/* Primary 버튼 클래스 */">
    + 업체 개설
  </Link>
</div>
```

### 3-3. ② KPI 요약 카드

`items` 데이터에서 클라이언트 사이드 집계. API 변경 없음.

```tsx
const stats = {
  total: items.length,
  active: items.filter(i => i.status === 'ACTIVE').length,
  trial: items.filter(i => i.status === 'TRIAL').length,
  suspended: items.filter(i => i.status === 'SUSPENDED').length,
};
```

카드 레이아웃:
```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
  {/* 전체 */}
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
    <div className="text-xs text-gray-500 mt-1">전체 업체</div>
  </div>

  {/* 운영 */}
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
    <div className="text-xs text-gray-500 mt-1">운영 중</div>
    <div className="mt-2 /* ACTIVE 배지 */"></div>
  </div>

  {/* 체험 */}
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="text-2xl font-bold text-amber-600">{stats.trial}</div>
    <div className="text-xs text-gray-500 mt-1">체험 중</div>
  </div>

  {/* 중지 */}
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="text-2xl font-bold text-red-500">{stats.suspended}</div>
    <div className="text-xs text-gray-500 mt-1">중지</div>
  </div>
</div>
```

### 3-4. ③ 검색 + 필터 바

```tsx
// 클라이언트 사이드 필터 state 추가
const [search, setSearch] = useState('');
const [filterPlan, setFilterPlan] = useState('');    // '' | 'starter' | 'standard' | 'premium'
const [filterStatus, setFilterStatus] = useState(''); // '' | 'ACTIVE' | 'TRIAL' | 'SUSPENDED'

// 필터 적용
const filtered = items.filter(item => {
  const q = search.toLowerCase();
  const matchSearch = !q ||
    item.name.toLowerCase().includes(q) ||
    item.slug.toLowerCase().includes(q) ||
    (item.ownerLoginId?.toLowerCase().includes(q) ?? false) ||
    (item.adminLoginIds?.some(id => id.toLowerCase().includes(q)) ?? false);
  const matchPlan = !filterPlan || item.plan === filterPlan;
  const matchStatus = !filterStatus || item.status === filterStatus;
  return matchSearch && matchPlan && matchStatus;
});
```

UI:
```tsx
<div className="flex flex-wrap gap-2 items-center">
  {/* 검색 */}
  <div className="relative flex-1 min-w-[200px]">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
    <input
      value={search}
      onChange={e => setSearch(e.target.value)}
      placeholder="업체명, 코드, 관리자 아이디 검색…"
      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
    />
  </div>

  {/* 플랜 필터 */}
  <select
    value={filterPlan}
    onChange={e => setFilterPlan(e.target.value)}
    className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
  >
    <option value="">전체 플랜</option>
    <option value="starter">Starter</option>
    <option value="standard">Standard</option>
    <option value="premium">Premium</option>
  </select>

  {/* 상태 필터 */}
  <select
    value={filterStatus}
    onChange={e => setFilterStatus(e.target.value)}
    className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
  >
    <option value="">전체 상태</option>
    <option value="ACTIVE">운영</option>
    <option value="TRIAL">체험</option>
    <option value="SUSPENDED">중지</option>
  </select>

  {/* 필터 초기화 — 하나라도 적용 시 노출 */}
  {(search || filterPlan || filterStatus) && (
    <button
      onClick={() => { setSearch(''); setFilterPlan(''); setFilterStatus(''); }}
      className="text-sm text-gray-500 hover:text-gray-700"
    >
      초기화
    </button>
  )}
</div>
```

### 3-5. ④ 테이블 (데스크탑 lg 이상)

컬럼: **업체** | **플랜** | **상태** | **사용자** | **접수** | **개설일** | **액션**

```tsx
// 각 행 (tr)
<tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">

  {/* 업체 */}
  <td className="px-4 py-3">
    <div className="font-medium text-gray-900 text-sm">{row.name}</div>
    <div className="text-xs text-gray-400 font-mono mt-0.5">{row.slug}</div>
  </td>

  {/* 플랜 — 섹션 1-2의 배지 사용 */}
  <td className="px-4 py-3">
    <span className="/* 플랜 배지 클래스 */">{row.plan}</span>
  </td>

  {/* 상태 — 섹션 1-1의 배지 사용 */}
  <td className="px-4 py-3">
    <span className="/* 상태 배지 클래스, dot 포함 */">
      <span className="/* dot */"></span>
      {STATUS_LABEL[row.status]}
    </span>
  </td>

  {/* 사용자 수 */}
  <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">{row.userCount}명</td>

  {/* 접수 수 */}
  <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">{row.inquiryCount.toLocaleString()}건</td>

  {/* 개설일 — createdAt 없으면 '—' */}
  <td className="px-4 py-3 text-xs text-gray-400">
    {row.createdAt ? new Date(row.createdAt).toLocaleDateString('ko-KR') : '—'}
  </td>

  {/* 액션 */}
  <td className="px-4 py-3">
    <Link to={`/platform/tenants/${row.id}`} className="/* Secondary 버튼 (작은 사이즈) */">
      관리
    </Link>
  </td>
</tr>
```

> **참고:** `row.createdAt` 필드가 API 응답에 없으면 해당 컬럼은 제거하고 나머지만 표시.

### 3-6. 모바일 카드 (lg 미만)

```tsx
<Link key={row.id} to={`/platform/tenants/${row.id}`} className="block p-4 hover:bg-gray-50">
  <div className="flex items-start justify-between gap-2">
    <div>
      <div className="font-medium text-gray-900">{row.name}</div>
      <div className="text-xs text-gray-400 font-mono mt-0.5">{row.slug}</div>
    </div>
    <div className="flex flex-col items-end gap-1.5">
      {/* 플랜 배지 */}
      {/* 상태 배지 */}
    </div>
  </div>
  <div className="mt-2 flex gap-3 text-xs text-gray-500">
    <span>사용자 {row.userCount}명</span>
    <span>접수 {row.inquiryCount.toLocaleString()}건</span>
  </div>
</Link>
```

---

## 4. PlatformTenantDetailPage 전체 재작성

**파일:** `client/src/pages/platform/PlatformTenantDetailPage.tsx`

### 4-1. 페이지 구조 ★ 탭 레이아웃

```
① 브레드크럼 + 페이지 헤더 (업체명 + 플랜/상태 배지 + 우상단 퀵액션)
② 알림 메시지 영역 (성공/에러)
③ 탭 바 (수평 탭 5개)
④ 탭별 콘텐츠 패널 (한 번에 하나만 표시)
```

**탭 목록 (순서 유지):**

| 탭 ID | 탭 라벨 | 내용 |
|-------|---------|------|
| `overview` | 개요 | 통계 3종 미니카드 + 기본 정보 폼 |
| `plan` | 플랜 · 기능 | 플랜 카드 선택 + 기능 모듈 토글 |
| `settings` | 설정 | L1 표시 설정 폼 + JSON 고급 편집 |
| `admins` | 관리자 계정 | 관리자 목록 + 추가 폼 |
| `danger` | 위험 구역 | 서비스 중지/재개, 체험→운영 전환, 삭제 |

**state:**
```tsx
const [activeTab, setActiveTab] = useState<'overview' | 'plan' | 'settings' | 'admins' | 'danger'>('overview');
```

### 4-2. ① 페이지 헤더

```tsx
{/* 브레드크럼 */}
<nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
  <Link to="/platform/tenants" className="hover:text-gray-900">업체 관리</Link>
  <span className="text-gray-300">/</span>
  <span className="text-gray-900 font-medium">{detail.tenant.name}</span>
</nav>

{/* 헤더 행 */}
<div className="flex flex-wrap items-center gap-3">
  <h1 className="text-xl font-bold text-gray-900">{detail.tenant.name}</h1>
  {/* 플랜 배지 */}
  <span className="/* 플랜 배지 (섹션 1-2) */">{detail.tenant.plan}</span>
  {/* 상태 배지 */}
  <span className="/* 상태 배지 (섹션 1-1) */">
    <span className="/* dot */"></span>
    {STATUS_LABEL[detail.tenant.status]}
  </span>

  {/* 우상단 퀵액션 */}
  <div className="ml-auto flex gap-2">
    <button
      onClick={() => { /* 대리 로그인 */ }}
      className="/* Secondary 버튼 */"
    >
      대리 로그인
    </button>
    {detail.tenant.status !== 'SUSPENDED' ? (
      <button
        onClick={() => {
          if (!confirm(`${detail.tenant.name} 서비스를 중지할까요?`)) return;
          setStatus('SUSPENDED');
          void handleSaveBasics();
        }}
        className="/* Danger 버튼 */"
      >
        서비스 중지
      </button>
    ) : (
      <button
        onClick={() => { setStatus('ACTIVE'); void handleSaveBasics(); }}
        className="/* Secondary 버튼 */"
      >
        서비스 재개
      </button>
    )}
  </div>
</div>
```

### 4-3. ③ 탭 바

```tsx
const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'plan',     label: '플랜 · 기능' },
  { id: 'settings', label: '설정' },
  { id: 'admins',   label: '관리자 계정' },
  { id: 'danger',   label: '위험 구역' },
] as const;

// 렌더링
<div className="flex border-b border-gray-200 gap-0 overflow-x-auto">
  {TABS.map(tab => (
    <button
      key={tab.id}
      type="button"
      onClick={() => setActiveTab(tab.id)}
      className={[
        'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
        activeTab === tab.id
          ? 'border-gray-900 text-gray-900'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
        tab.id === 'danger' && activeTab !== 'danger'
          ? 'text-red-400 hover:text-red-600 hover:border-red-300'
          : '',
      ].join(' ')}
    >
      {tab.label}
    </button>
  ))}
</div>
```

> **스타일 포인트:** "위험 구역" 탭은 비활성 상태일 때 `text-red-400`으로 미리 경고색 표시. 활성 시 `border-gray-900 text-gray-900`으로 통일.

### 4-4. 탭 패널 — 개요 (`activeTab === 'overview'`)

```tsx
{activeTab === 'overview' && (
  <div className="space-y-5">

    {/* 통계 미니카드 3종 */}
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: '사용자',  value: `${detail.tenant.userCount ?? '—'}명` },
        { label: '총 접수', value: `${(detail.tenant.inquiryCount ?? 0).toLocaleString()}건` },
        { label: '이달 접수', value: `${(detail.stats?.monthInquiryCount ?? 0).toLocaleString()}건` },
      ].map(({ label, value }) => (
        <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500 mt-1">{label}</div>
        </div>
      ))}
    </div>

    {/* 기본 정보 폼 */}
    <section className="/* 섹션 카드 */">
      <h2 className="text-base font-semibold text-gray-900">기본 정보</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* 업체명, slug, 가입일(읽기전용), 현재 플랜(읽기전용 배지) — 기존 동일 */}
      </div>
      <div className="flex justify-end pt-2 border-t border-gray-100">
        <button onClick={handleSaveBasics} disabled={saving} className="/* Primary 버튼 */">
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </section>

  </div>
)}
```

> **참고:** `monthInquiryCount` 없으면 `—` 표시 또는 해당 카드 숨김.

### 4-5. 탭 패널 — 플랜·기능 (`activeTab === 'plan'`)  ★ 핵심 변경

기존 `<select>` → **플랜 카드 3종** + **기능 모듈 토글 목록**.

```tsx
const PLAN_DESCRIPTIONS = {
  starter: {
    features: ['서비스접수·발주서', '스케줄', '배정', '메시지'],
  },
  standard: {
    features: ['Starter 전체 포함', 'C/S 관리', '타업체·외부정산', '크루(현장)', '팀장 통계'],
  },
  premium: {
    features: ['Standard 전체 포함', '광고비 관리', '급여·정산', '전자계약'],
  },
};

{activeTab === 'plan' && (
  <div className="space-y-5">

    {/* 플랜 선택 카드 */}
    <section className="/* 섹션 카드 */">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">플랜 선택</h2>
        <p className="text-xs text-gray-400">변경 시 기능 모듈이 자동 재설정됩니다</p>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-2">
        {(['starter', 'standard', 'premium'] as const).map((pid) => {
          const isSelected = plan === pid;
          return (
            <button
              key={pid}
              type="button"
              onClick={() => {
                setPlan(pid);
                handleResetFromPlan(pid); // 플랜 변경 시 모듈 자동 재설정
              }}
              className={[
                'text-left rounded-xl border-2 p-4 transition-all',
                pid === 'premium' && isSelected ? 'border-purple-500 bg-purple-50'
                  : pid === 'standard' && isSelected ? 'border-blue-500 bg-blue-50'
                  : isSelected ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300',
              ].join(' ')}
            >
              <div className={[
                'text-sm font-bold capitalize mb-2',
                pid === 'premium' && isSelected ? 'text-purple-700'
                  : pid === 'standard' && isSelected ? 'text-blue-700'
                  : 'text-gray-900',
              ].join(' ')}>
                {pid.charAt(0).toUpperCase() + pid.slice(1)}
                {isSelected && ' ✓'}
              </div>
              <ul className="space-y-1">
                {PLAN_DESCRIPTIONS[pid].features.map(f => (
                  <li key={f} className="text-xs text-gray-500">· {f}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end pt-3 border-t border-gray-100 mt-3">
        <button onClick={handleSaveBasics} disabled={saving} className="/* Primary 버튼 */">
          플랜 저장
        </button>
      </div>
    </section>

    {/* 기능 모듈 토글 */}
    <section className="/* 섹션 카드 */">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">기능 모듈 개별 설정</h2>
          <p className="text-xs text-gray-500 mt-0.5">플랜 외 개별 기능을 on/off 할 수 있습니다. core 모듈은 잠겨 있습니다.</p>
        </div>
        <button onClick={() => handleResetFromPlan(plan)} disabled={saving} className="/* Secondary 버튼 (작은) */">
          플랜 기본값으로 재설정
        </button>
      </div>
      <ul className="divide-y divide-gray-100 mt-3">
        {features.map(f => (
          <li key={f.moduleId} className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-gray-900">{f.label}</div>
              <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                <span className="font-mono">{f.moduleId}</span>
                {f.locked && (
                  <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">
                    core · 잠금
                  </span>
                )}
                {!f.inPlan && (
                  <span className="inline-block px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px]">
                    플랜 외
                  </span>
                )}
              </div>
            </div>
            {/* Toggle 컴포넌트 — 섹션 4-8 참고 */}
            <Toggle
              checked={f.enabled}
              disabled={f.locked}
              onChange={() => toggleFeature(f.moduleId)}
            />
          </li>
        ))}
      </ul>
      <div className="flex justify-end pt-3 border-t border-gray-100">
        <button onClick={handleSaveFeatures} disabled={saving} className="/* Primary 버튼 */">
          {saving ? '저장 중…' : '기능 저장'}
        </button>
      </div>
    </section>

  </div>
)}
```

### 4-6. 탭 패널 — 설정 (`activeTab === 'settings'`)

L1 설정(표시명, 접수번호 접두, 로그인 부제, 발주서 부제)을 폼으로 편집. 고급 JSON 편집은 접힌 섹션으로 하단 배치.

```tsx
{activeTab === 'settings' && (
  <div className="space-y-5">

    {/* 화면 표시 설정 폼 */}
    <section className="/* 섹션 카드 */">
      <h2 className="text-base font-semibold text-gray-900">화면 표시 설정</h2>
      <p className="text-xs text-gray-500 mt-0.5 mb-4">
        코드 없이 입력만으로 업체별 표시 문구와 기본값을 설정합니다.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">표시명</label>
          <input ... className="/* 입력 기본 스타일 */" />
          <p className="text-[10px] text-gray-400 mt-1">로그인·헤더에 표시되는 업체 이름</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">접수번호 접두</label>
          <input ... className="/* 입력 기본 스타일 */" />
          <p className="text-[10px] text-gray-400 mt-1">영문·숫자·_- 만 허용 (예: SK-)</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">로그인 부제</label>
          <input ... className="/* 입력 기본 스타일 */" />
          <p className="text-[10px] text-gray-400 mt-1">업체 로그인 화면 한 줄 안내 문구</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">고객 발주서 부제</label>
          <input ... className="/* 입력 기본 스타일 */" />
          <p className="text-[10px] text-gray-400 mt-1">고객이 여는 발주서 상단 안내 문구</p>
        </div>
      </div>
      <div className="flex justify-end pt-3 border-t border-gray-100 mt-2">
        <button onClick={handleSaveL1} disabled={saving} className="/* Primary 버튼 */">
          {saving ? '저장 중…' : '설정 저장'}
        </button>
      </div>
    </section>

    {/* 고급 — JSON 직접 편집 (접힌 섹션) */}
    <details className="/* 섹션 카드 */ group">
      <summary className="cursor-pointer text-sm font-medium text-gray-500 list-none flex items-center gap-2">
        <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
        고급 · JSON 직접 편집
      </summary>
      <p className="text-xs text-gray-400 mt-2 mb-3">
        JSON으로 전체 설정을 직접 수정합니다. 잘못된 값은 서비스에 영향을 줄 수 있습니다.
      </p>
      <textarea
        value={l1ConfigRaw}
        onChange={e => setL1ConfigRaw(e.target.value)}
        rows={8}
        className="w-full font-mono text-xs border border-gray-200 rounded-lg p-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-y"
      />
      <div className="flex justify-end mt-2">
        <button onClick={handleSaveL1Raw} disabled={saving} className="/* Secondary 버튼 (작은) */">
          JSON으로 저장
        </button>
      </div>
    </details>

  </div>
)}
```

### 4-7. 탭 패널 — 관리자 계정 (`activeTab === 'admins'`)

기존 `PlatformTenantAdminsSection` 컴포넌트를 래핑.

```tsx
{activeTab === 'admins' && (
  <section className="/* 섹션 카드 */">
    <h2 className="text-base font-semibold text-gray-900 mb-3">관리자 계정</h2>
    <p className="text-xs text-gray-500 mb-4">
      이 업체에 관리자 권한으로 로그인할 수 있는 계정 목록입니다.
    </p>
    <PlatformTenantAdminsSection tenantId={detail.tenant.id} token={token} />
  </section>
)}
```

### 4-8. 탭 패널 — 위험 구역 (`activeTab === 'danger'`)  ★ 신규

```tsx
{activeTab === 'danger' && (
  <div className="border border-red-100 rounded-xl p-6 bg-white space-y-0">
    <h2 className="text-base font-semibold text-red-600 mb-1">⚠ 위험 구역</h2>
    <p className="text-xs text-gray-500 mb-5">아래 작업은 되돌리기 어렵습니다. 신중하게 사용하세요.</p>

    {/* 서비스 중지 / 재개 */}
    <div className="flex items-start justify-between gap-4 py-4 border-b border-red-50">
      <div>
        <div className="text-sm font-semibold text-gray-900">서비스 일시 중지</div>
        <div className="text-xs text-gray-400 mt-1">
          이 업체의 모든 로그인을 즉시 차단합니다. 재개 시 정상 복원됩니다.
        </div>
      </div>
      {detail.tenant.status !== 'SUSPENDED' ? (
        <button
          onClick={() => {
            if (!confirm(`${detail.tenant.name} 서비스를 중지할까요?`)) return;
            setStatus('SUSPENDED');
            void handleSaveBasics();
          }}
          className="/* Danger 버튼 */ shrink-0"
        >
          서비스 중지
        </button>
      ) : (
        <button
          onClick={() => { setStatus('ACTIVE'); void handleSaveBasics(); }}
          className="/* Secondary 버튼 */ shrink-0"
        >
          서비스 재개
        </button>
      )}
    </div>

    {/* 체험 → 운영 전환 (TRIAL 상태일 때만 표시) */}
    {detail.tenant.status === 'TRIAL' && (
      <div className="flex items-start justify-between gap-4 py-4 border-b border-red-50">
        <div>
          <div className="text-sm font-semibold text-gray-900">체험 → 운영 전환</div>
          <div className="text-xs text-gray-400 mt-1">체험 기간을 종료하고 정식 운영 상태로 변경합니다.</div>
        </div>
        <button
          onClick={() => {
            if (!confirm('체험을 종료하고 운영으로 전환할까요?')) return;
            setStatus('ACTIVE');
            void handleSaveBasics();
          }}
          className="/* Secondary 버튼 */ shrink-0"
        >
          운영으로 전환
        </button>
      </div>
    )}

    {/* 테넌트 삭제 (추후 구현 — 현재는 비활성) */}
    <div className="flex items-start justify-between gap-4 pt-4">
      <div>
        <div className="text-sm font-semibold text-gray-900">테넌트 삭제</div>
        <div className="text-xs text-gray-400 mt-1">업체와 모든 데이터를 영구 삭제합니다. 복구가 불가능합니다.</div>
      </div>
      <button
        disabled
        className="/* 위험 강조 버튼 */ shrink-0 opacity-40 cursor-not-allowed"
        title="추후 구현 예정"
      >
        삭제
      </button>
    </div>

  </div>
)}
```

> **구현 방법:** 퀵액션(중지/재개)은 `status` state 변경 후 `handleSaveBasics()` 바로 호출. 별도 API 추가 불필요. 삭제 버튼은 이번 명세에서 `disabled` 처리 후 추후 구현.

### 4-9. Toggle 컴포넌트 (공유, 파일 상단에 정의)

```tsx
function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={[
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
        checked ? 'bg-blue-600' : 'bg-gray-200',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}

---

## 5. 알림 메시지 스타일 통일

성공/에러 메시지 박스 (페이지 상단 또는 섹션 하단):

```tsx
{/* 성공 */}
{message && (
  <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-700">
    <span>✓</span> {message}
  </div>
)}

{/* 에러 */}
{error && (
  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
    <span>!</span> {error}
  </div>
)}
```

---

## 6. 작업 순서 (권장)

1. **공통 유틸 함수** 먼저 작성: `getPlanBadgeClass(plan)`, `getStatusBadgeClass(status)` — 두 파일에서 공유
2. `PlatformTenantListPage` 재작성 (KPI 카드 → 검색바 → 테이블)
3. `PlatformTenantDetailPage` 헤더 + `activeTab` state + 탭 바 구조 잡기
4. 탭 패널 순서대로 구현: 개요 → 플랜·기능 → 설정 → 관리자 계정 → 위험 구역
5. `Toggle` 컴포넌트 인라인 정의 (파일 상단)
6. 알림 메시지 스타일 통일

---

## 7. 체크리스트 (Cursor 작업 완료 기준)

- [ ] 목록 상단에 KPI 카드 4개 (전체·운영·체험·중지 숫자) 표시
- [ ] 검색창에서 업체명·slug·관리자 아이디 필터링 작동
- [ ] 플랜·상태 필터 드롭다운 작동
- [ ] 상태가 색상 배지(dot 포함)로 표시
- [ ] 상세 페이지가 **탭 레이아웃** (개요 / 플랜·기능 / 설정 / 관리자 계정 / 위험 구역)
- [ ] 탭 클릭 시 해당 패널만 표시, 나머지 숨김
- [ ] 위험 구역 탭 비활성 상태에서 `text-red-400` 색상 표시
- [ ] 플랜이 3종 카드 UI로 표시 (현재 플랜 하이라이트, 선택 시 모듈 자동 재설정)
- [ ] 기능 모듈이 토글 스위치로 표시 (체크박스 제거)
- [ ] 설정 탭에서 L1 필드 4개를 폼으로 편집 가능 (JSON 편집은 접힌 고급 섹션)
- [ ] 위험 구역 탭에서 중지/재개·체험→운영 전환 작동
- [ ] 개요 탭에서 통계 미니카드 3종 표시
- [ ] 알림 메시지 스타일 통일
- [ ] 기존 로직·API·store 변경 없음
