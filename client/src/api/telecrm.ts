const API = '/api/crm';

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? '요청에 실패했습니다.');
  return data as T;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type TelecrmScriptTabDto = {
  id: string;
  categoryId: string;
  label: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
};

export type TelecrmScriptCategoryDto = {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  tabs?: TelecrmScriptTabDto[];
};

export type TelecrmPriceItemDto = {
  id: string;
  categoryId: string;
  name: string;
  amountWon: number;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type TelecrmPriceCategoryDto = {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  items?: TelecrmPriceItemDto[];
};

export type TelecrmPricingCatalogDto = {
  categories: TelecrmPriceCategoryDto[];
  estimateConfig: { pricePerPyeong: number; depositAmount: number };
};

export type TelecrmCustomerLookupDto = {
  match: 'existing' | 'new';
  customer: {
    name: string | null;
    nickname: string | null;
    phone: string;
    lastAddress: string | null;
  };
  inquiries: {
    id: string;
    status: string;
    createdAt: string;
    customerName: string;
    nickname: string | null;
    customerPhone: string;
    memo: string | null;
    address: string;
    areaPyeong: number | null;
  }[];
  followups: {
    id: string;
    status: string;
    createdAt: string;
    customerName: string;
    nickname: string | null;
    customerPhone: string;
    memo: string | null;
    inquiryId: string | null;
  }[];
  csReports: {
    id: string;
    status: string;
    createdAt: string;
    customerName: string;
    customerPhone: string;
    content: string;
    memo: string | null;
    inquiryId: string | null;
  }[];
};

export async function fetchTelecrmCustomerLookup(
  token: string,
  phone: string,
): Promise<TelecrmCustomerLookupDto> {
  const q = encodeURIComponent(phone.trim());
  const res = await fetch(`${API}/customer-lookup?phone=${q}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export async function fetchTelecrmScripts(
  token: string,
  opts?: { includeInactive?: boolean },
): Promise<{ categories: TelecrmScriptCategoryDto[] }> {
  const q = opts?.includeInactive ? '?includeInactive=1' : '';
  const res = await fetch(`${API}/script-categories${q}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export async function createTelecrmScriptCategory(
  token: string,
  body: { label: string },
): Promise<TelecrmScriptCategoryDto> {
  const res = await fetch(`${API}/script-categories`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function updateTelecrmScriptCategory(
  token: string,
  id: string,
  body: Partial<{ label: string; sortOrder: number; isActive: boolean }>,
): Promise<TelecrmScriptCategoryDto> {
  const res = await fetch(`${API}/script-categories/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function deleteTelecrmScriptCategory(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API}/script-categories/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
  await parseJson(res);
}

export async function reorderTelecrmScriptCategories(
  token: string,
  orderedIds: string[],
): Promise<void> {
  const res = await fetch(`${API}/script-categories/reorder`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ orderedIds }),
  });
  await parseJson(res);
}

export async function createTelecrmScriptTab(
  token: string,
  body: { categoryId: string; label: string; body?: string },
): Promise<TelecrmScriptTabDto> {
  const res = await fetch(`${API}/script-tabs`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function updateTelecrmScriptTab(
  token: string,
  id: string,
  body: Partial<{ label: string; body: string; sortOrder: number; isActive: boolean }>,
): Promise<TelecrmScriptTabDto> {
  const res = await fetch(`${API}/script-tabs/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function deleteTelecrmScriptTab(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API}/script-tabs/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
  await parseJson(res);
}

export async function reorderTelecrmScriptTabs(
  token: string,
  categoryId: string,
  orderedIds: string[],
): Promise<void> {
  const res = await fetch(`${API}/script-tabs/reorder`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ categoryId, orderedIds }),
  });
  await parseJson(res);
}

export async function fetchTelecrmPriceCategories(
  token: string,
  opts?: { includeInactive?: boolean },
): Promise<{ categories: TelecrmPriceCategoryDto[] }> {
  const q = opts?.includeInactive ? '?includeInactive=1' : '';
  const res = await fetch(`${API}/price-categories${q}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export async function createTelecrmPriceCategory(
  token: string,
  body: { label: string },
): Promise<TelecrmPriceCategoryDto> {
  const res = await fetch(`${API}/price-categories`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function updateTelecrmPriceCategory(
  token: string,
  id: string,
  body: Partial<{ label: string; sortOrder: number; isActive: boolean }>,
): Promise<TelecrmPriceCategoryDto> {
  const res = await fetch(`${API}/price-categories/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function deleteTelecrmPriceCategory(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API}/price-categories/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
  await parseJson(res);
}

export async function reorderTelecrmPriceCategories(
  token: string,
  orderedIds: string[],
): Promise<void> {
  const res = await fetch(`${API}/price-categories/reorder`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ orderedIds }),
  });
  await parseJson(res);
}

export async function createTelecrmPriceItem(
  token: string,
  body: { categoryId: string; name: string; amountWon: number; description?: string },
): Promise<TelecrmPriceItemDto> {
  const res = await fetch(`${API}/price-items`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function updateTelecrmPriceItem(
  token: string,
  id: string,
  body: Partial<{
    name: string;
    amountWon: number;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  }>,
): Promise<TelecrmPriceItemDto> {
  const res = await fetch(`${API}/price-items/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function deleteTelecrmPriceItem(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API}/price-items/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
  await parseJson(res);
}

export async function reorderTelecrmPriceItems(
  token: string,
  categoryId: string,
  orderedIds: string[],
): Promise<void> {
  const res = await fetch(`${API}/price-items/reorder`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ categoryId, orderedIds }),
  });
  await parseJson(res);
}

export async function fetchTelecrmPricingCatalog(
  token: string,
  q?: string,
): Promise<TelecrmPricingCatalogDto> {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  const res = await fetch(`${API}/pricing/catalog${qs}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export type TelecrmOrderOptionDto = {
  id: string;
  label: string;
  labelPath: string;
  priceAmount: number | null;
  priceHint: string | null;
  emoji: string | null;
};

export async function fetchTelecrmOrderOptions(
  token: string,
  q?: string,
): Promise<{ items: TelecrmOrderOptionDto[] }> {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  const res = await fetch(`${API}/order-options${qs}`, { headers: authHeaders(token) });
  return parseJson(res);
}
