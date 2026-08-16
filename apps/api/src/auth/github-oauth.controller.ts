import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { GitHubOAuthService } from './github-oauth.service';
import type { Response } from 'express';

@Controller('api/v1/auth/oauth/github')
export class GitHubOAuthController {
  constructor(private readonly githubOAuthService: GitHubOAuthService) {}

  /**
   * GET /api/v1/auth/oauth/github
   * Initiates GitHub OAuth authorization for the authenticated DevOS user.
   * Creates Redis-backed OAuth state and returns the authorization URL for browser navigation.
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async initiateOAuth(@CurrentUser() user: any) {
    const authUrl = await this.githubOAuthService.getAuthorizationUrl(user.id);
    return { url: authUrl, authorizationUrl: authUrl };
  }

  /**
   * GET /api/v1/auth/oauth/github/callback
   * Public callback handling GitHub authorization code and state validation.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/settings?error=invalid_oauth_params`);
    }

    try {
      await this.githubOAuthService.handleCallback(code, state);
      return res.redirect(`${frontendUrl}/settings`);
    } catch (err: any) {
      const errorKind =
        err?.status === 409 ? 'github_already_linked' : 'oauth_failed';
      return res.redirect(`${frontendUrl}/settings?error=${errorKind}`);
    }
  }
}
