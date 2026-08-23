export class AuthSignupOAuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 401 | 403 | 404 | 409 | 503 = 400,
  ) {
    super(message);
    this.name = 'AuthSignupOAuthError';
  }
}
