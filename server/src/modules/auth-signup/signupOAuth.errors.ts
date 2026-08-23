export class AuthSignupOAuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 409 | 503 = 400,
  ) {
    super(message);
    this.name = 'AuthSignupOAuthError';
  }
}
