import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get, Res, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { Response, Request } from 'express';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  @Post('register')
  async register(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    if (!body.email || !body.password || !body.username) {
      return { error: 'Missing fields' };
    }
    const { accessToken, refreshToken } = await this.authService.register(body);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    if (!body.identity || !body.password) {
      return { error: 'Missing fields' };
    }
    const { accessToken, refreshToken } = await this.authService.login(body);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const oldRefreshToken = req.cookies?.['refresh_token'];
    const { accessToken, refreshToken } = await this.authService.refresh(oldRefreshToken);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'];
    await this.authService.logout(refreshToken);
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/api/v1/auth',
    });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    const stats = await this.authService.getUserStats(user.id);
    return { user, stats };
  }
}
