const TOKEN_KEY = 'sk_team_token';

export function getTeamToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setTeamToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearTeamToken() {
  localStorage.removeItem(TOKEN_KEY);
}
