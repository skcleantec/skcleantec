/** 판매자센터 로그인 창. 아이디·비밀번호를 주소에 넣지 않고 로그인 요청만 보낸다. */
export function openSellerCenterLoggedIn(loginId: string, password: string): boolean {
  const popup = window.open('', '_blank');
  if (!popup) return false;
  const doc = popup.document;
  doc.open();
  doc.write('<!doctype html><meta charset="utf-8"><title>판매자센터</title><p style="font-family:sans-serif">판매자센터로 이동 중</p>');
  doc.close();
  const form = doc.createElement('form');
  form.method = 'POST';
  form.action = 'https://wspay.net/login_check.php';
  for (const [name, value] of [
    ['mb_id', loginId],
    ['mb_password', password],
    ['url', ''],
  ] as const) {
    const input = doc.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  doc.body.appendChild(form);
  form.submit();
  return true;
}
